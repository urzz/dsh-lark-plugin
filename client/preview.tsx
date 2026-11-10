// Detached review harness. Never imported by the distributable client entry.
import { useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import type { ConfigFormSnapshot, SettingsMirrorSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client';
import { LarkConfig } from './LarkConfig.js';
import { en, zh } from './locales.js';
import css from './style.css';

const initial = { appId: 'cli_review_example', brand: 'feishu', executable: '', cwd: '/workspace', timeoutMs: 120000, maxOutputBytes: 1000000 };
let state: ConfigFormSnapshot<Record<string, unknown>> = { status: 'ready', value: initial, base: initial, user: {}, revision: 1, writable: true };
let settings: SettingsMirrorSnapshot = { status: 'ready', error: null, view: { writable: true, hasDocument: true, namespaces: [{ ns: 'lark-plugin', value: initial, schema: {}, autoGenerate: false, applies: 'live', revision: 1, secrets: [{ path: ['appSecret'], set: true }] }] } };
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const emit = () => listeners.forEach(listener => listener());
let refuse = false;
function Preview() {
  const [locale, setLocale] = useState('en');
  return <main style={{ maxWidth: 680, margin: '24px auto', padding: '0 20px' }}>
    <nav aria-label="Review controls"><label>Language <select value={locale} onChange={event => setLocale(event.target.value)}><option value="en">English</option><option value="zh">中文</option></select></label>{' '}
      <button onClick={() => { state = { ...state, revision: state.revision! + 1 }; emit(); }}>Simulate concurrent change</button>{' '}
      <button onClick={() => { refuse = !refuse; }}>Toggle save failure</button>{' '}
      <button onClick={() => { state = { ...state, writable: !state.writable }; emit(); }}>Toggle read-only</button>
    </nav>
    <p>Detached review — in-memory configuration only</p>
    <LarkConfig view="page" t={key => (locale === 'zh' ? zh : en)[key]}
      useConfig={selector => selector(useSyncExternalStore(subscribe, () => state))}
      useSettings={selector => selector(useSyncExternalStore(subscribe, () => settings))}
      mutateConfig={async (ops, revision) => {
        await new Promise(resolve => setTimeout(resolve, 600));
        if (refuse || revision !== state.revision) return false;
        const value = { ...state.value };
        let secretSet = settings.view!.namespaces[0].secrets[0].set;
        for (const op of ops) {
          const field = op.path[0];
          if (field === 'appSecret') { secretSet = op.op === 'set' && op.value !== ''; continue; }
          value[field] = op.op === 'set' ? op.value : initial[field as keyof typeof initial];
        }
        state = { ...state, value, revision: state.revision! + 1 };
        settings = { ...settings, view: { ...settings.view!, namespaces: [{ ...settings.view!.namespaces[0], revision: state.revision!, secrets: [{ path: ['appSecret'], set: secretSet }] }] } };
        emit();
        return true;
      }} />
  </main>;
}
const style = document.createElement('style'); style.textContent = css; document.head.append(style);
createRoot(document.getElementById('root')!).render(<Preview />);
