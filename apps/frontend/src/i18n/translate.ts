// Чистое ядро i18n (без React) — чтобы переиспользовать в провайдере И в hermetic-тесте.
// Ключи адресуются точечным путём ('nav.cockpit'); значение ищется в активном словаре, при отсутствии —
// фолбэк на базовый (en); если нет нигде — возвращается сам ключ (видимый сигнал «строка не переведена»).
// Интерполяция: плейсхолдеры вида {name} заменяются значениями params; отсутствующий param остаётся как {name}.

export type Dict = { [k: string]: string | Dict };

export function resolvePath(obj: Dict | undefined, path: string): unknown {
  if (!obj) return undefined;
  return path.split('.').reduce<unknown>((o, k) => (o != null && typeof o === 'object' ? (o as Dict)[k] : undefined), obj);
}

export function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, p: string) => (p in params ? String(params[p]) : `{${p}}`));
}

// Перевод ключа: activeDict → fallbackDict(en) → сам ключ. params — для интерполяции.
export function translateKey(activeDict: Dict, fallbackDict: Dict, key: string, params?: Record<string, string | number>): string {
  let val = resolvePath(activeDict, key);
  if (typeof val !== 'string') val = resolvePath(fallbackDict, key);
  if (typeof val !== 'string') return key;
  return interpolate(val, params);
}

// Плоский список всех ключей словаря (для проверки покрытия в тесте).
export function flattenKeys(obj: Dict, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v != null && typeof v === 'object') out.push(...flattenKeys(v as Dict, path));
    else out.push(path);
  }
  return out;
}
