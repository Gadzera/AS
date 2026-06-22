/**
 * Единый LLM-клиент для всего сервиса.
 *
 * Провайдеры (в порядке приоритета):
 *   1. DeepSeek (OpenAI-совместимый, через fetch — основной)
 *   2. Anthropic (через SDK — если задан только ANTHROPIC_API_KEY)
 *   3. none → demo-режим (детерминированные заглушки в вызывающем коде)
 *
 * Все AI-функции (claude.ts, services/ai) ходят сюда. Demo-развилка у них:
 * `if (!llmAvailable()) return <demo>` — то есть БЕЗ ключей сервис продолжает
 * работать детерминированно, а с ключом DeepSeek — «вживую».
 */

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';

export type LlmProvider = 'deepseek' | 'anthropic' | 'none';

export function llmProvider(): LlmProvider {
  if (config.deepseek.apiKey.trim()) return 'deepseek';
  if (config.anthropic.apiKey.trim()) return 'anthropic';
  return 'none';
}

/** Доступен ли реальный LLM (есть хоть один ключ). */
export function llmAvailable(): boolean {
  return llmProvider() !== 'none';
}

export interface LlmOptions {
  /** Системная инструкция (роль/правила). */
  system?: string;
  /** Пользовательский промпт. */
  prompt: string;
  /** Лимит токенов ответа. */
  maxTokens?: number;
  /** Температура (0 — детерминированно). */
  temperature?: number;
  /** Просить строгий JSON-ответ. */
  json?: boolean;
}

const DEFAULT_TIMEOUT_MS = 60_000;

// ─── Anthropic ────────────────────────────────────────────────────────────

let _anthropic: Anthropic | null = null;
function anthropicClient(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });
  return _anthropic;
}

async function anthropicComplete(opts: LlmOptions): Promise<string> {
  const res = await anthropicClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature,
    ...(opts.system ? { system: opts.system } : {}),
    messages: [{ role: 'user', content: opts.prompt }],
  });
  const block = res.content[0];
  return block && block.type === 'text' ? block.text.trim() : '';
}

// ─── DeepSeek (OpenAI-совместимый chat/completions) ─────────────────────────

async function deepseekComplete(opts: LlmOptions): Promise<string> {
  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
  if (opts.system) messages.push({ role: 'system', content: opts.system });
  messages.push({ role: 'user', content: opts.prompt });

  const body: Record<string, unknown> = {
    model: config.deepseek.model,
    messages,
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.7,
    stream: false,
  };
  if (opts.json) body.response_format = { type: 'json_object' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  let lastErr: unknown = null;
  // Одна повторная попытка на сетевые/5xx-сбои.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await fetch(`${config.deepseek.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.deepseek.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        // 4xx (кроме 429) не повторяем — это ошибка запроса/ключа.
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          throw new Error(`DeepSeek ${res.status}: ${text.slice(0, 300)}`);
        }
        lastErr = new Error(`DeepSeek ${res.status}: ${text.slice(0, 300)}`);
        continue;
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      clearTimeout(timer);
      return (data.choices?.[0]?.message?.content ?? '').trim();
    } catch (err) {
      lastErr = err;
      if (controller.signal.aborted) break;
    }
  }
  clearTimeout(timer);
  throw lastErr instanceof Error ? lastErr : new Error('DeepSeek request failed');
}

// ─── Публичный API ──────────────────────────────────────────────────────────

/** Выполнить запрос к LLM (бросает, если провайдер не настроен — проверяйте llmAvailable()). */
export async function llmComplete(opts: LlmOptions): Promise<string> {
  const provider = llmProvider();
  if (provider === 'deepseek') return deepseekComplete(opts);
  if (provider === 'anthropic') return anthropicComplete(opts);
  throw new Error('LLM provider not configured (no DEEPSEEK_API_KEY / ANTHROPIC_API_KEY)');
}

/** Снять markdown-обёртку ```json … ``` и распарсить JSON. null при неудаче. */
export function parseJsonLoose<T = unknown>(text: string): T | null {
  if (!text) return null;
  let cleaned = text.trim();
  // Убираем ```json / ``` ограждения.
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) cleaned = fence[1].trim();
  // Берём от первой { или [ до последней } или ].
  const firstBrace = cleaned.search(/[[{]/);
  const lastBrace = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

/** Удобный helper: запрос с ожиданием JSON-объекта/массива. */
export async function llmJson<T = unknown>(opts: LlmOptions): Promise<T | null> {
  const text = await llmComplete({ ...opts, json: true });
  return parseJsonLoose<T>(text);
}
