import type { SettingsPathOpView } from '@deepseek-ai/dsh-api-remotes/client';

export const fields = ['appId', 'brand', 'executable', 'cwd', 'timeoutMs', 'maxOutputBytes'] as const;
export type Field = typeof fields[number];
export type Values = Record<Field, string>;
export function valuesOf(value: Record<string, unknown>): Values {
  // Read only public fields. In particular, never hydrate the password input.
  return Object.fromEntries(fields.map(field => [field, String(value[field] ?? '')])) as Values;
}
export function valid(values: Values): boolean {
  return ['feishu', 'lark'].includes(values.brand)
    && Number.isSafeInteger(Number(values.timeoutMs)) && Number(values.timeoutMs) >= 1000
    && Number.isSafeInteger(Number(values.maxOutputBytes)) && Number(values.maxOutputBytes) >= 1024
    && Number(values.maxOutputBytes) <= 20000000;
}
export function removeCredentials(): SettingsPathOpView[] {
  return ['appId', 'appSecret'].map(field => ({ op: 'set', path: [field], value: '' }));
}
export function operations(values: Values, accepted: Values, replacement: string, reset = false): SettingsPathOpView[] {
  // Reset ordinary overrides only: a redacted secret can never be round-tripped.
  if (reset) return fields.filter(field => field !== 'appId').map(field => ({ op: 'unset', path: [field] }));
  const ops: SettingsPathOpView[] = fields.filter(field => values[field] !== accepted[field]).map(field => ({
    op: 'set', path: [field], value: field === 'timeoutMs' || field === 'maxOutputBytes' ? Number(values[field]) : values[field],
  }));
  if (replacement !== '') ops.push({ op: 'set', path: ['appSecret'], value: replacement });
  return ops;
}
