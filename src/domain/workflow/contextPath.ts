export function normalizeContextPath(path: string | null | undefined): string {
  if (!path) return '';
  return path.trim().replace(/^\$\./, '').replace(/^\$/, '');
}

export function getContextPath(source: unknown, path: string | null | undefined): unknown {
  const normalized = normalizeContextPath(path);
  if (!normalized) return source;

  return normalized
    .split('.')
    .filter(Boolean)
    .reduce<unknown>((current, key) => {
      if (current == null || typeof current !== 'object') return undefined;
      return (current as Record<string, unknown>)[key];
    }, source);
}

export function setContextPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const normalized = normalizeContextPath(path);
  if (!normalized) return;

  const parts = normalized.split('.').filter(Boolean);
  let current: Record<string, unknown> = target;

  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    const existing = current[key];

    if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
      current[key] = {};
    }

    current = current[key] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = structuredClone(value);
}
