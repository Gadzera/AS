/**
 * LST-2 (Module 6 Lists · pipeline): list-local стадии PIPELINE-списков.
 *
 * Принципы (план GPT, /c/6a2fd6d8, Q3/Q4):
 *  • PIPELINE = РУЧНОЕ членство (ListEntry, как STATIC) + стадии, ХРАНЯЩИЕСЯ НА LISTENTRY (per-list).
 *  • config.stages принадлежит КОНКРЕТНОМУ списку; ListEntry.stage = stage-key именно ЭТОГО списка
 *    (это НЕ атрибут записи и НЕ M24 board-view, который группирует по SELECT/USER-атрибуту записи).
 *  • key стабилен (идентичность стадии); label/color/order редактируемы. Дубликаты key → 422.
 *  • Нельзя удалить стадию с entries без moveToStage. Reorder стадий НЕ двигает entries.
 *  • Комбо DYNAMIC+PIPELINE вне scope (тип списка один).
 */

export interface PipelineStage {
  key: string;
  label: string;
  color: string | null;
  order: number;
}

/** Дефолтные стадии для нового PIPELINE-списка (можно переопределить при создании/в config). */
export const LIST_STAGE_DEFAULTS: PipelineStage[] = [
  { key: 'lead', label: 'Lead', color: '#94a3b8', order: 0 },
  { key: 'in_progress', label: 'In progress', color: '#6366f1', order: 1 },
  { key: 'won', label: 'Won', color: '#22c55e', order: 2 },
  { key: 'lost', label: 'Lost', color: '#ef4444', order: 3 },
];

export const MAX_PIPELINE_STAGES = 50;
const STAGE_KEY_RE = /^[a-zA-Z0-9_-]{1,40}$/;

export class StageConfigError extends Error {
  statusCode: number;
  code: string;
  constructor(message: string, code: string, statusCode = 422) {
    super(message);
    this.name = 'StageConfigError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Валидирует и нормализует массив стадий: ≥1, ≤MAX, key соответствует [a-zA-Z0-9_-]{1,40} и уникален,
 * label непустой. order нормализуется к индексу массива (порядок = позиция в массиве). Дубликат key → 422.
 */
export function validateStages(raw: unknown): PipelineStage[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new StageConfigError('A pipeline needs at least one stage.', 'INVALID_STAGES');
  }
  if (raw.length > MAX_PIPELINE_STAGES) {
    throw new StageConfigError(`A pipeline can have at most ${MAX_PIPELINE_STAGES} stages.`, 'INVALID_STAGES');
  }
  const seen = new Set<string>();
  const stages: PipelineStage[] = [];
  raw.forEach((s) => {
    const rec = (s && typeof s === 'object') ? (s as Record<string, unknown>) : {};
    const key = typeof rec.key === 'string' ? rec.key.trim() : '';
    const label = typeof rec.label === 'string' ? rec.label.trim() : '';
    if (!key || !STAGE_KEY_RE.test(key)) {
      throw new StageConfigError(`Stage key "${key}" is invalid — use letters, digits, "-" or "_" (max 40).`, 'INVALID_STAGES');
    }
    if (!label) {
      throw new StageConfigError(`Stage "${key}" needs a label.`, 'INVALID_STAGES');
    }
    if (seen.has(key)) {
      throw new StageConfigError(`Duplicate stage key "${key}".`, 'DUPLICATE_STAGE_KEY');
    }
    seen.add(key);
    const color = typeof rec.color === 'string' && rec.color.trim() ? rec.color.trim().slice(0, 40) : null;
    stages.push({ key, label: label.slice(0, 60), color, order: stages.length });
  });
  return stages;
}

/** Читает стадии из List.config. Возвращает [] если не PIPELINE / нет стадий. */
export function readStages(config: unknown): PipelineStage[] {
  if (config && typeof config === 'object' && !Array.isArray(config)) {
    const raw = (config as Record<string, unknown>).stages;
    if (Array.isArray(raw)) {
      // читаем lenient — не валидируем строго на чтении (битый config не должен ронять открытие борда)
      return raw
        .map((s, i) => {
          const rec = (s && typeof s === 'object') ? (s as Record<string, unknown>) : {};
          const key = typeof rec.key === 'string' ? rec.key : '';
          if (!key) return null;
          return { key, label: typeof rec.label === 'string' ? rec.label : key, color: typeof rec.color === 'string' ? rec.color : null, order: typeof rec.order === 'number' ? rec.order : i } as PipelineStage;
        })
        .filter((x): x is PipelineStage => x !== null)
        .sort((a, b) => a.order - b.order);
    }
  }
  return [];
}

export function firstStageKey(stages: PipelineStage[]): string | null {
  return stages.length ? stages[0].key : null;
}

export function stageKeySet(stages: PipelineStage[]): Set<string> {
  return new Set(stages.map((s) => s.key));
}
