import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const result = await build({ entryPoints: ['client/model.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const { valuesOf, operations, removeCredentials, valid, fields } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const accepted = valuesOf({ appId: 'cli_example', brand: 'feishu', executable: '', cwd: '/workspace', timeoutMs: 120000, maxOutputBytes: 1000000 });

test('unrelated saves and resets leave redacted secret untouched', () => {
  const values = { ...accepted, timeoutMs: '2000' };
  assert.deepEqual(operations(values, accepted, ''), [{ op: 'set', path: ['timeoutMs'], value: 2000 }]);
  const reset = operations(values, accepted, 'discard-this-replacement', true);
  assert.deepEqual(reset, fields.filter(field => field !== 'appId').map(field => ({ op: 'unset', path: [field] })));
  assert.equal(reset.some(op => op.path.includes('appSecret')), false);
  assert.deepEqual(operations(accepted, accepted, 'new-secret'), [{ op: 'set', path: ['appSecret'], value: 'new-secret' }]);
});
test('explicit removal clears both app credentials even over inherited base', () => {
  assert.deepEqual(removeCredentials(), [
    { op: 'set', path: ['appId'], value: '' },
    { op: 'set', path: ['appSecret'], value: '' },
  ]);
});
test('accepted values never hydrate a secret or other unknown keys', () => {
  const values = valuesOf({ ...accepted, appSecret: 'do-not-echo', unknown: 'ignored' });
  assert.equal(JSON.stringify(values).includes('do-not-echo'), false);
  assert.deepEqual(Object.keys(values), [...fields]);
});
test('numeric limits match host boundaries', () => {
  assert.equal(valid(accepted), true);
  for (const value of ['0', '999', '1000.1', 'Infinity', '']) assert.equal(valid({ ...accepted, timeoutMs: value }), false);
  for (const value of ['1023', '20000001', '1024.5']) assert.equal(valid({ ...accepted, maxOutputBytes: value }), false);
  assert.equal(valid({ ...accepted, timeoutMs: '1000', maxOutputBytes: '20000000' }), true);
  assert.equal(valid({ ...accepted, brand: 'other' }), false);
});
test('DSH bundle loads through shared modules and registers exact plugin row', async () => {
  let plugin;
  const requested = [];
  const react = { useId() {}, useState() {} };
  vm.runInNewContext(await readFile('lib/client.js', 'utf8'), {
    window: { __ModuleLoader__: { load(def) {
      assert.equal(def.id, 'dsh-lark-plugin');
      plugin = def.factory(id => { requested.push(id); if (id === 'react') return react; if (id === 'react/jsx-runtime') return {}; throw Error(`Unexpected runtime module ${id}`); });
    } } },
  });
  assert.deepEqual(requested.sort(), ['react', 'react/jsx-runtime']);
  const registrations = [];
  const namespaces = [];
  const form = { getSnapshot() {}, subscribe() {}, mutate() {} };
  const settings = { getSnapshot() {}, subscribe() {} };
  let response = { ok: true, value: { status: 'not_authorized' } };
  function inject(deps, setup) {
    assert.deepEqual(Array.from(deps), ['remote.larkConnection']);
    return setup({ ...this, remote: { larkConnection: { async test() { return response; } } } });
  }
  await plugin.apply({
    inject,
    remote: { async $mount() {} },
    effect() {}, locale: { register() {} },
    configForms: { get(ns) { namespaces.push(ns); return form; }, describe() { return settings; } },
    slots: { inject(name, register) { return register(); }, register(spec, component) { registrations.push({ spec, component }); } },
  });
  // Run effects separately so no DOM is required for stylesheet installation.
  const effects = [];
  await plugin.apply({
    inject, remote: { async $mount() {} }, effect(fn) { effects.push(fn); }, locale: { register() {} }, configForms: { get() { return form; }, describe() { return settings; } }, slots: { inject(name, register) { assert.equal(name, 'plugins.row.config'); return register(); }, register(spec, component) { registrations.push({ spec, component }); } } });
  effects[2]();
  assert.equal(namespaces[0], 'lark-plugin');
  assert.equal(registrations[0].spec.key, 'dsh-lark-plugin#lark-plugin');
  assert.equal(registrations[0].spec.locale, 'larkPlugin');
  const face = registrations[0].spec.inject();
  assert.equal(typeof face.mutateConfig, 'function');
  assert.equal((await face.testConnection()).status, 'not_authorized');
  response = { ok: false, error: { code: 'gateway/service-unavailable', message: 'private-message', details: { secret: 'private-secret' } } };
  assert.equal(JSON.stringify(await face.testConnection()), JSON.stringify({ status: 'remote_failed', errorCode: 'gateway/service-unavailable' }));
  response.error.code = 'private-code';
  assert.equal(JSON.stringify(await face.testConnection()), JSON.stringify({ status: 'remote_failed' }));
});
