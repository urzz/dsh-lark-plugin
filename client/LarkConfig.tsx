import { useId, useState } from 'react';
import type { ConfigForm, ConfigFormSnapshot, SettingsMirrorSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client';
import { operations, removeCredentials, valid, valuesOf, type Field, type Values } from './model.js';
import type { Message } from './locales.js';
import type { ConnectionResult } from './remote.js';

export interface LarkConfigProps {
  view: 'summary' | 'page';
  t: (key: Message) => string;
  useConfig: <T>(selector: (state: ConfigFormSnapshot<Record<string, unknown>>) => T) => T;
  useSettings: <T>(selector: (state: SettingsMirrorSnapshot) => T) => T;
  mutateConfig: ConfigForm<Record<string, unknown>>['mutate'];
  testConnection: () => Promise<ConnectionResult>;
}
export function LarkConfig(props: LarkConfigProps) {
  const { t } = props;
  const state = props.useConfig(snapshot => snapshot);
  const settings = props.useSettings(snapshot => snapshot);
  const id = useId();
  const [draft, setDraft] = useState<{ values: Values; revision: number | undefined } | null>(null);
  const [secret, setSecret] = useState('');
  const [pending, setPending] = useState<'save' | 'reset' | 'clear' | 'test' | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [testResult, setTestResult] = useState<(ConnectionResult & { revision: number | undefined }) | null>(null);
  if (props.view === 'summary') return t('description');
  if (state.status !== 'ready' || !state.value) return <p role="status">{t(state.status === 'loading' ? 'loading' : 'unavailable')}</p>;
  const accepted = valuesOf(state.value);
  const values = draft?.values ?? accepted;
  const conflict = draft !== null && draft.revision !== state.revision;
  const disabled = !state.writable || pending !== null;
  const secretSet = settings.view?.namespaces.find(section => section.ns === 'lark-plugin')?.secrets.find(slot => slot.path.length === 1 && slot.path[0] === 'appSecret')?.set;
  const edit = (field: Field, value: string) => {
    setDraft({ values: { ...values, [field]: value }, revision: draft ? draft.revision : state.revision });
    setMessage(null);
  };
  const discard = () => { setDraft(null); setSecret(''); setMessage(null); };
  const save = async (reset: boolean, clear = false) => {
    if (disabled) return;
    if (conflict) { setMessage('conflict'); return; }
    if (!reset && !clear && !valid(values)) { setMessage('invalid'); return; }
    const ops = clear ? removeCredentials() : operations(values, accepted, secret, reset);
    setPending(clear ? 'clear' : reset ? 'reset' : 'save');
    setMessage(null);
    try {
      if (await props.mutateConfig(ops, draft ? draft.revision : state.revision)) {
        setDraft(null); setSecret(''); setMessage(clear ? 'removed' : reset ? 'resetDone' : 'saved');
      } else setMessage('failed');
    } catch { setMessage('failed'); }
    finally { setPending(null); }
  };
  const testConnection = async () => {
    setPending('test');
    setTestResult(null);
    setMessage(null);
    try {
      const result = await props.testConnection();
      setTestResult({ ...result, revision: state.revision });
    } catch { setTestResult({ status: 'remote_failed', revision: state.revision }); }
    finally { setPending(null); }
  };
  const input = (field: Field, hint?: Message) => <label key={field}>
    <span>{t(field)}</span>
    <input name={field} type={field === 'timeoutMs' || field === 'maxOutputBytes' ? 'number' : 'text'}
      min={field === 'timeoutMs' ? 1000 : field === 'maxOutputBytes' ? 1024 : undefined}
      max={field === 'maxOutputBytes' ? 20000000 : undefined} step={field === 'timeoutMs' || field === 'maxOutputBytes' ? 1 : undefined}
      value={values[field]} onChange={event => edit(field, event.target.value)}
      aria-describedby={hint ? `${id}-${hint}` : undefined} autoComplete="off" spellCheck={false} />
    {hint && <small id={`${id}-${hint}`}>{t(hint)}</small>}
  </label>;
  return <form className="dsh-lark-config" aria-label={t('title')} aria-busy={pending !== null} onSubmit={event => { event.preventDefault(); void save(false); }}>
    <p className="dsh-lark-hint">{t('shared')}</p>
    <p className="dsh-lark-hint">{t('cliSource')}{' '}
      {accepted.executable.trim() ? <>{t('externalCli')}{' '}<code>{accepted.executable.trim()}</code></> : t('bundledCli')}
    </p>
    <p className="dsh-lark-hint">
      <a href={values.brand === 'lark' ? 'https://open.larksuite.com/app' : 'https://open.feishu.cn/app'} target="_blank" rel="noopener noreferrer">{t('manageApps')}</a>
      {' '}{t('credentialsHint')}
    </p>
    <fieldset disabled={disabled}>
      {input('appId')}
      <label><span>{t('appSecret')}</span>
        <input name="appSecret" type="password" value={secret} autoComplete="new-password" spellCheck={false}
          aria-describedby={`${id}-secret`} onChange={event => {
            setSecret(event.target.value);
            setDraft(current => current ?? { values, revision: state.revision });
            setMessage(null);
          }} />
        <small id={`${id}-secret`}>{t(secretSet === true ? 'secretSet' : secretSet === false ? 'secretUnset' : 'secretUnknown')}</small>
      </label>
      <label><span>{t('brand')}</span><select name="brand" value={values.brand} onChange={event => edit('brand', event.target.value)}>
        <option value="feishu">{t('feishu')}</option><option value="lark">{t('lark')}</option>
      </select></label>
      <details><summary>{t('advanced')}</summary>
        {input('executable', 'executableHint')}{input('cwd', 'cwdHint')}{input('timeoutMs')}{input('maxOutputBytes')}
      </details>
    </fieldset>
    {!state.writable && <p role="status">{t('readOnly')}</p>}
    {conflict && <p role="alert">{t('conflict')}</p>}
    {message && <p role={message === 'failed' || message === 'invalid' ? 'alert' : 'status'}>{t(message)}</p>}
    {!draft && testResult && testResult.revision === state.revision && <p role={testResult.status === 'connected' ? 'status' : 'alert'}>{t(testResult.status)}{testResult.status === 'remote_failed' && testResult.errorCode && <> <code>{testResult.errorCode}</code></>}</p>}
    <div className="dsh-lark-actions">
      <button className="dsh-lark-primary" type="submit" disabled={disabled || conflict || !draft}>{t(pending === 'save' ? 'saving' : 'save')}</button>
      <button type="button" disabled={pending !== null || draft !== null} aria-describedby={`${id}-test`} onClick={() => { void testConnection(); }}>{t(pending === 'test' ? 'testing' : 'testConnection')}</button>
      <button type="button" disabled={pending !== null || !draft} onClick={discard}>{t('discard')}</button>
      <button type="button" disabled={disabled || conflict} aria-describedby={`${id}-reset`} onClick={() => { void save(true); }}>{t(pending === 'reset' ? 'resetting' : 'reset')}</button>
      <button type="button" disabled={disabled || conflict || (!accepted.appId && secretSet !== true)} onClick={() => { void save(false, true); }}>{t(pending === 'clear' ? 'removing' : 'remove')}</button>
    </div>
    <p id={`${id}-test`} className="dsh-lark-hint">{t(draft ? 'testSaveFirst' : 'testHint')}</p>
    <p id={`${id}-reset`} className="dsh-lark-hint">{t('resetHint')}</p>
  </form>;
}
