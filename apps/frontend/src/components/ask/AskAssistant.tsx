'use client';

/* ──────────────────────────────────────────────────────────────────────────
   AskAssistant (M26-1) — переиспользуемая панель ассистента Ask AISDR.
   Тред с персистом (chatId), grounded-ответы под RBAC (/api/ask), citations,
   предложенные действия (confirm-gated), follow-up подсказки. Используется в
   /ask (полный экран + рейл чатов) и в topbar slide-over (compact). Bold-тема.
   ────────────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { askApi, authApi, type AskResponse, type AskAction, type AskCitation } from '@/lib/api';
import { Sparkles, Bot, SendHorizonal, Loader2, ArrowUpRight, CheckCircle2, ListChecks, X, PencilLine, Mail, Globe, BookMarked } from 'lucide-react';
import PromptLibrary from './PromptLibrary';

type AgentData = { answer: string; citations: AskCitation[]; action: AskAction | null; suggestions: string[]; generatedBy: string; webResearch?: boolean };
type AgentMsg = { role: 'agent'; pending?: boolean; error?: boolean; data?: AgentData; actionState?: 'idle' | 'applying' | 'done' | 'dismissed'; actionResult?: string };
type UserMsg = { role: 'user'; text: string };
type Msg = UserMsg | AgentMsg;

function engineLabel(by?: string): string {
  if (by === 'demo') return 'AI · grounded (offline)';
  if (by === 'deepseek' || by === 'anthropic') return 'AI · grounded by your data';
  return 'AI';
}

export default function AskAssistant({
  chatId,
  onChatId,
  autoSend,
  compact,
}: {
  /** активный тред; смена извне перезагружает историю */
  chatId?: string | null;
  /** уведомить родителя о созданном/выбранном чате */
  onChatId?: (id: string) => void;
  /** отправить этот вопрос автоматически при монтировании (homepage deep-link) */
  autoSend?: string;
  /** компактный режим (slide-over) */
  compact?: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [starters, setStarters] = useState<string[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(chatId ?? null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [canManageWs, setCanManageWs] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoSentRef = useRef(false);

  useEffect(() => { askApi.starters().then((s) => setStarters(s.suggestions)).catch(() => {}); }, []);
  useEffect(() => { authApi.me().then((u) => setCanManageWs(u.role === 'OWNER' || u.role === 'ADMIN')).catch(() => {}); }, []);

  // загрузка истории при смене chatId извне
  useEffect(() => {
    setActiveChat(chatId ?? null);
    if (!chatId) { setMessages([]); return; }
    let alive = true;
    askApi.getChat(chatId).then((c) => {
      if (!alive) return;
      const ms: Msg[] = [];
      for (const m of c.messages) {
        if (m.role === 'USER') ms.push({ role: 'user', text: m.content });
        else ms.push({ role: 'agent', data: { answer: m.content, citations: m.citations, action: m.action, suggestions: [], generatedBy: m.generatedBy ?? '' }, actionState: m.action?.status === 'APPLIED' ? 'done' : m.action?.status === 'DISMISSED' ? 'dismissed' : 'idle', actionResult: m.action?.status === 'APPLIED' ? 'Applied.' : undefined });
      }
      setMessages(ms);
    }).catch(() => {});
    return () => { alive = false; };
  }, [chatId]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages]);

  const send = useCallback(async (qRaw: string) => {
    const q = qRaw.trim();
    if (!q || sending) return;
    setInput('');
    setSending(true);
    setMessages((m) => [...m, { role: 'user', text: q }, { role: 'agent', pending: true }]);
    try {
      const res: AskResponse = await askApi.ask(q, activeChat ?? undefined);
      if (!activeChat) { setActiveChat(res.chatId); onChatId?.(res.chatId); }
      setMessages((m) => {
        const copy = [...m];
        for (let i = copy.length - 1; i >= 0; i--) {
          if (copy[i].role === 'agent' && (copy[i] as AgentMsg).pending) { copy[i] = { role: 'agent', data: { answer: res.answer, citations: res.citations, action: res.action, suggestions: res.suggestions, generatedBy: res.generatedBy, webResearch: res.webResearch }, actionState: 'idle' }; break; }
        }
        return copy;
      });
    } catch {
      setMessages((m) => {
        const copy = [...m];
        for (let i = copy.length - 1; i >= 0; i--) {
          if (copy[i].role === 'agent' && (copy[i] as AgentMsg).pending) { copy[i] = { role: 'agent', error: true }; break; }
        }
        return copy;
      });
    } finally {
      setSending(false);
    }
  }, [sending, activeChat, onChatId]);

  // авто-отправка вопроса с homepage (один раз)
  useEffect(() => {
    if (autoSend && !autoSentRef.current) { autoSentRef.current = true; void send(autoSend); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSend]);

  const confirmAction = useCallback(async (idx: number, action: AskAction) => {
    // NAVIGATE — клиентское действие (router.push), серверу применять нечего
    if (action.kind === 'NAVIGATE' && action.href) { router.push(action.href); return; }
    if (!action.id) {
      setMessages((m) => m.map((msg, i) => (i === idx && msg.role === 'agent' ? { ...msg, actionResult: 'This action can’t be applied (no saved id).' } : msg)));
      return;
    }
    // реальный apply сохранённого действия; clientRequestId=action.id делает повтор/двойной клик идемпотентным
    setMessages((m) => m.map((msg, i) => (i === idx && msg.role === 'agent' ? { ...msg, actionState: 'applying', actionResult: undefined } : msg)));
    try {
      const out = await askApi.applyAction(action.id, action.id);
      const r = out.result;
      let label = 'Done.';
      if (out.kind === 'CREATE_TASK') label = 'Task created — added to your tasks.';
      else if (out.kind === 'UPDATE_RECORD') label = r?.changed === false && r?.type === 'record_update' ? 'No change — the field already had that value.' : `Updated ${r?.attributeLabel ?? 'the field'}${r?.newDisplay ? ` → ${r.newDisplay}` : ''}.`;
      else if (out.kind === 'DRAFT_EMAIL') label = r?.note ?? 'Draft saved. Sending isn’t connected yet.';
      window.dispatchEvent(new Event('notifications:refresh'));
      window.dispatchEvent(new Event('credits:refresh'));
      setMessages((m) => m.map((msg, i) => (i === idx && msg.role === 'agent' ? { ...msg, actionState: 'done', actionResult: label } : msg)));
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setMessages((m) => m.map((mm, i) => (i === idx && mm.role === 'agent' ? { ...mm, actionState: 'idle', actionResult: msg ?? 'Could not apply the action — try again.' } : mm)));
    }
  }, [router]);

  const dismissAction = (idx: number) => setMessages((m) => m.map((msg, i) => (i === idx && msg.role === 'agent' ? { ...msg, actionState: 'dismissed' } : msg)));
  const empty = messages.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className={`min-h-0 flex-1 overflow-y-auto ${compact ? 'px-3 py-4' : 'px-4 py-5'}`}>
        {empty ? (
          <div className={`mx-auto flex flex-col items-center text-center ${compact ? 'max-w-sm pt-6' : 'max-w-2xl pt-10'}`}>
            <span className="brand-gradient mb-3 flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-brand"><Bot size={22} /></span>
            <h2 className={`font-extrabold tracking-[-0.01em] text-ink ${compact ? 'text-[15px]' : 'text-[18px]'}`}>Ask the agent anything</h2>
            <p className={`mt-1.5 max-w-md text-ink-muted ${compact ? 'text-[12px]' : 'text-[12.5px]'}`}>Answers are grounded strictly in the data you can access — leads, replies, records, meetings and tasks. The agent can also propose a safe next action for you to confirm.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {starters.map((s) => (
                <button key={s} type="button" onClick={() => void send(s)} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] font-medium text-ink-muted shadow-xs transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700">
                  <Sparkles size={12} className="text-brand-500" /> {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className={`mx-auto space-y-4 ${compact ? 'max-w-full' : 'max-w-2xl'}`}>
            {messages.map((m, i) => (m.role === 'user'
              ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-md bg-brand-600 px-3.5 py-2 text-[13px] font-medium text-white shadow-brand">{m.text}</div>
                </div>
              )
              : <AgentBubble key={i} msg={m} onConfirm={(a) => void confirmAction(i, a)} onDismiss={() => dismissAction(i)} onSuggest={(s) => void send(s)} />
            ))}
          </div>
        )}
      </div>

      <div className={`shrink-0 border-t border-line bg-surface/80 ${compact ? 'px-3 py-2.5' : 'px-4 py-3'}`}>
        <div className={`mx-auto mb-1.5 flex items-center justify-end ${compact ? 'max-w-full' : 'max-w-2xl'}`}>
          <button type="button" onClick={() => setPromptOpen(true)} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-muted transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700">
            <BookMarked size={12} className="text-brand-500" /> Prompt library
          </button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className={`mx-auto flex items-end gap-2 rounded-2xl border border-line bg-surface p-2 shadow-sm focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-100 ${compact ? 'max-w-full' : 'max-w-2xl'}`}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input); } }}
            rows={1}
            placeholder="Ask about your leads, records, meetings, objections…"
            className="max-h-32 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-[13.5px] text-ink outline-none placeholder:text-ink-subtle"
          />
          <button type="submit" disabled={sending || !input.trim()} className={['inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all', input.trim() && !sending ? 'brand-gradient text-white shadow-brand hover:-translate-y-0.5' : 'cursor-not-allowed bg-surface-2 text-ink-subtle'].join(' ')}>
            {sending ? <Loader2 size={16} className="animate-spin" /> : <SendHorizonal size={16} />}
          </button>
        </form>
        <p className={`mx-auto mt-1.5 px-1 text-[10.5px] text-ink-subtle ${compact ? 'max-w-full' : 'max-w-2xl'}`}>Ask AISDR answers only from data you can access and never sends anything externally. Proposed actions run only after you confirm.</p>
      </div>

      <PromptLibrary open={promptOpen} onClose={() => setPromptOpen(false)} onInsert={(b) => setInput(b)} seedBody={input} canManageWorkspace={canManageWs} />
    </div>
  );
}

function AgentBubble({ msg, onConfirm, onDismiss, onSuggest }: { msg: AgentMsg; onConfirm: (a: AskAction) => void; onDismiss: () => void; onSuggest: (s: string) => void }) {
  if (msg.pending) {
    return (
      <div className="flex items-start gap-2.5">
        <span className="brand-gradient mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white"><Bot size={15} /></span>
        <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-line bg-surface px-3.5 py-2.5 text-[12.5px] text-ink-muted shadow-xs">
          <Loader2 size={13} className="animate-spin text-brand-500" /> Thinking — reading your workspace…
        </div>
      </div>
    );
  }
  if (msg.error || !msg.data) {
    return (
      <div className="flex items-start gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600"><Bot size={15} /></span>
        <div className="rounded-2xl rounded-bl-md border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[12.5px] text-rose-700 shadow-xs">Sorry — I couldn’t answer that just now. Please try again.</div>
      </div>
    );
  }
  const d = msg.data;
  return (
    <div className="flex items-start gap-2.5">
      <span className="brand-gradient mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white"><Bot size={15} /></span>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="rounded-2xl rounded-bl-md border border-line bg-surface px-3.5 py-2.5 shadow-xs">
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink">{d.answer}</p>
          {d.citations.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-line pt-2.5">
              {d.citations.map((c, ci) => {
                const inner = (
                  <>
                    <span className="font-bold text-ink">{c.value}</span>
                    <span className="text-ink-subtle">{c.label}</span>
                    {c.href && <ArrowUpRight size={10} className="text-brand-500" />}
                  </>
                );
                return c.href
                  ? <a key={ci} href={c.href} className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-2/50 px-1.5 py-0.5 text-[10.5px] transition-colors hover:border-brand-200 hover:bg-brand-50">{inner}</a>
                  : <span key={ci} className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-2/50 px-1.5 py-0.5 text-[10.5px]">{inner}</span>;
              })}
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            {d.generatedBy && <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-600"><Sparkles size={9} /> {engineLabel(d.generatedBy)}</span>}
            {d.webResearch === false && (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-1.5 py-0.5 text-[9.5px] font-semibold text-ink-subtle" title="Live web research isn’t connected — answers use only your workspace data">
                <Globe size={9} /> Web research: not connected
              </span>
            )}
          </div>
        </div>

        {d.action && msg.actionState !== 'dismissed' && (
          msg.actionState === 'done' ? (
            <div className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-700"><CheckCircle2 size={14} /> {msg.actionResult ?? 'Done.'}</div>
          ) : (
            <ActionCard action={d.action} applying={msg.actionState === 'applying'} error={msg.actionResult} onConfirm={() => onConfirm(d.action!)} onDismiss={onDismiss} />
          )
        )}

        {d.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {d.suggestions.slice(0, 4).map((s) => (
              <button key={s} type="button" onClick={() => onSuggest(s)} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] text-ink-muted transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"><Sparkles size={10} className="text-brand-400" /> {s}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Карточка предложенного действия (confirm-gated). Реальный apply на бэке (M26-2).
function ActionCard({ action, applying, error, onConfirm, onDismiss }: { action: AskAction; applying: boolean; error?: string; onConfirm: () => void; onDismiss: () => void }) {
  const kind = action.kind;
  const head = kind === 'CREATE_TASK' ? { icon: <ListChecks size={12} />, label: 'Suggested task' }
    : kind === 'UPDATE_RECORD' ? { icon: <PencilLine size={12} />, label: 'Suggested record update' }
    : kind === 'DRAFT_EMAIL' ? { icon: <Mail size={12} />, label: 'Suggested email draft' }
    : { icon: <ArrowUpRight size={12} />, label: 'Suggested action' };
  const cta = kind === 'CREATE_TASK' ? 'Confirm & create task'
    : kind === 'UPDATE_RECORD' ? 'Confirm & update'
    : kind === 'DRAFT_EMAIL' ? 'Confirm & save draft'
    : action.label;

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/70 p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-brand-700">{head.icon} {head.label} — your confirmation required</div>

      {kind === 'CREATE_TASK' && action.task && (
        <div className="mb-2">
          <p className="text-[12.5px] font-bold text-ink">{action.task.title}</p>
          {action.task.body && <p className="mt-0.5 text-[11.5px] leading-4 text-ink-muted">{action.task.body}</p>}
          {action.task.leadName && <p className="mt-0.5 text-[11px] text-ink-subtle">Related lead: {action.task.leadName}</p>}
        </div>
      )}

      {kind === 'UPDATE_RECORD' && action.update && (
        <div className="mb-2">
          <p className="text-[12.5px] font-bold text-ink">{action.update.objectName} · set {action.update.attributeLabel}</p>
          <div className="mt-1 flex items-center gap-2 text-[11.5px]">
            <span className="rounded-md border border-line bg-surface px-1.5 py-0.5 text-ink-muted line-through decoration-rose-300">{action.update.currentDisplay || '—'}</span>
            <ArrowUpRight size={12} className="rotate-90 text-brand-500" />
            <span className="rounded-md border border-brand-200 bg-brand-50 px-1.5 py-0.5 font-semibold text-brand-700">{action.update.newDisplay}</span>
          </div>
        </div>
      )}

      {kind === 'DRAFT_EMAIL' && action.draft && (
        <div className="mb-2">
          <p className="text-[12.5px] font-bold text-ink">{action.draft.subject}</p>
          <p className="mt-0.5 whitespace-pre-wrap text-[11.5px] leading-4 text-ink-muted line-clamp-4">{action.draft.body}</p>
          <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700"><Mail size={9} /> Draft only · sending unavailable until a mailbox is connected</p>
        </div>
      )}

      {action.rationale && <p className="mb-2 text-[11px] leading-4 text-ink-muted"><span className="font-bold text-ink">Why:</span> {action.rationale}</p>}
      {error && <p className="mb-2 text-[11px] font-semibold text-rose-600">{error}</p>}
      <div className="flex items-center gap-2">
        <button type="button" disabled={applying} onClick={onConfirm} className="brand-gradient inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11.5px] font-semibold text-white shadow-brand transition-all hover:-translate-y-0.5 disabled:opacity-60">
          {applying ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} {applying ? 'Applying…' : cta}
        </button>
        <button type="button" disabled={applying} onClick={onDismiss} className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[11.5px] font-medium text-ink-muted hover:bg-surface-2 disabled:opacity-60"><X size={12} /> Dismiss</button>
      </div>
    </div>
  );
}
