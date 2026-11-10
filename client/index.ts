import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type {} from '@deepseek-ai/dsh-client-locale/client';
import type {} from '@deepseek-ai/dsh-client-ui-settings/client';
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client';
import { LarkConfig } from './LarkConfig.js';
import { en, zh } from './locales.js';
import css from './style.css';

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { larkPlugin: keyof typeof en; }
}

export const inject = ['slots', 'locale', 'configForms'];
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register('larkPlugin', { en, zh }));
  ctx.effect(() => {
    const style = document.createElement('style');
    style.dataset.plugin = 'dsh-lark-plugin';
    style.textContent = css;
    document.head.append(style);
    return () => style.remove();
  });
  const form = ctx.configForms.get<Record<string, unknown>>('lark-plugin');
  const settings = ctx.configForms.describe();
  const face = {
    hooks: {
      config: { getSnapshot: () => form.getSnapshot(), subscribe: (listener: () => void) => form.subscribe(listener) },
      settings: { getSnapshot: () => settings.getSnapshot(), subscribe: (listener: () => void) => settings.subscribe(listener) },
    },
    mutateConfig: (ops: Parameters<typeof form.mutate>[0], revision?: number) => form.mutate(ops, revision),
  };
  ctx.effect(() => ctx.slots.inject('plugins.row.config', () => ctx.slots.register({
    name: 'plugins.row.config', key: 'dsh-lark-plugin#lark-plugin', locale: 'larkPlugin', inject: () => face,
  }, LarkConfig)));
}
