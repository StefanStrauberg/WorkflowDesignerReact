export function normalizeContextPath(path: string | null | undefined): string {
  if (!path) return '';
  return path.trim().replace(/^\$\./, '').replace(/^\$/, '');
}

const FORBIDDEN_PATH_PARTS = new Set(['__proto__', 'prototype', 'constructor']);

function contextPathParts(path: string | null | undefined): string[] {
  const normalized = normalizeContextPath(path);
  if (!normalized) return [];

  const parts = normalized.split('.').filter(Boolean);
  if (parts.some((part) => FORBIDDEN_PATH_PARTS.has(part))) {
    throw new Error(`Недопустимый сегмент Context path: "${path}".`);
  }
  return parts;
}

export function getContextPath(source: unknown, path: string | null | undefined): unknown {
  const parts = contextPathParts(path);
  if (!parts.length) return source;

  return parts.reduce<unknown>((current, key) => {
      if (current == null || typeof current !== 'object') return undefined;
      return (current as Record<string, unknown>)[key];
    }, source);
}

export function setContextPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = contextPathParts(path);
  if (!parts.length) return;
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
