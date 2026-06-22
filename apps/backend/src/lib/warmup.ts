/**
 * M11-9: единый расчёт warm-up отправки. Один источник для воркера (processor) и обзора
 * последовательности (sequences overview) — чтобы UI показывал ровно тот лимит, по которому реально
 * шлёт воркер. Возраст кампании ИСКЛЮЧАЕТ время простоя (pausedDaysAccum, M11-4): пауза не прогревает.
 */

/** Эффективный возраст кампании в днях для warm-up: календарные дни минус накопленный простой. */
export function effectiveCampaignAgeDays(createdAt: Date | string, pausedDaysAccum = 0): number {
  const ms = Date.now() - new Date(createdAt).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000 - (pausedDaysAccum || 0)));
}

/** Лимит отправок/день с учётом прогрева (ramp) и потолка dailyLimit. */
export function warmupLimit(ageDays: number, dailyLimit: number): number {
  const tier = ageDays < 3 ? 20 : ageDays < 7 ? 50 : ageDays < 14 ? 100 : dailyLimit;
  return Math.min(tier, dailyLimit);
}

/** Человекочитаемая стадия прогрева (для UI обзора последовательности). */
export function warmupStage(ageDays: number): string {
  return ageDays < 3 ? 'Day 1–2 · 20/day'
    : ageDays < 7 ? 'Day 3–6 · 50/day'
    : ageDays < 14 ? 'Day 7–13 · 100/day'
    : 'Full speed';
}
