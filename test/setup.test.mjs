import assert from 'node:assert/strict';
import test from 'node:test';
import { createSetup } from '../lib/setup.js';
import { createRunner } from '../lib/runner.js';
import { Config } from '../lib/index.js';

function fixture(overrides = {}, behavior = {}) {
  const calls = []; let release;
  const subprocess = {
    async resolveExecutable(command) { calls.push({ resolve: command }); return '/external/cli'; },
    spawn(spec) {
      calls.push(spec);
      const stream = text => ({ readFrom() { return { text, nextOffset: text.length, lossy: false }; } });
      const done = behavior.pending ? new Promise(resolve => {
        release = () => resolve({ exitCode: 0, signal: null });
        spec.signal.addEventListener('abort', () => resolve({ exitCode: null, signal: 'SIGTERM' }), { once: true });
      }) : Promise.resolve({ exitCode: behavior.fail ? 1 : 0, signal: null });
      return { done, collected: { stdout: stream('raw private app-secret diagnostic'), stderr: stream('raw private app-secret diagnostic') } };
    },
  };
  const options = Config({ appId: 'cli_app', appSecret: 'app-secret', ...overrides }).get();
  return { calls, subprocess, options, setup: createSetup(subprocess, options), release: () => release() };
}

test('bundled CLI uses absolute node and resolved launcher without PATH; explicit override resolves externally', async () => {
  const f = fixture({ appId: '', appSecret: '' });
  await createRunner(f.subprocess, f.options)(['--version']);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].argv[0], process.execPath);
  assert.match(f.calls[0].argv[1], /@larksuite\/cli\/scripts\/run\.js$/);
  assert.equal(f.calls[0].argv[2], '--version');
  const g = fixture({ executable: '/custom/cli' });
  await createRunner(g.subprocess, g.options)(['--version']);
  assert.deepEqual(g.calls[0], { resolve: '/custom/cli' });
  assert.deepEqual(g.calls[1].argv, ['/external/cli', '--version']);
});

test('setup is shared once, preserves stdin secrecy, and suppresses diagnostics', async () => {
  const f = fixture({}, { pending: true });
  const a = f.setup.ensure(); const b = f.setup.ensure();
  await Promise.resolve();
  assert.equal(f.calls.length, 1);
  assert.deepEqual(f.calls[0].argv.slice(2), ['config', 'init', '--name', 'dsh-lark-plugin', '--app-id', 'cli_app', '--app-secret-stdin', '--brand', 'feishu', '--profile', 'dsh-lark-plugin']);
  assert.deepEqual(f.calls[0].stdio.stdin, { data: 'app-secret\n' });
  assert.doesNotMatch(JSON.stringify(f.calls[0].argv), /app-secret(?!-stdin)/);
  f.release();
  assert.deepEqual(await Promise.all([a, b]), [undefined, undefined]);
  assert.equal(await f.setup.ensure(), undefined);
  assert.equal(f.calls.length, 1);
  const g = fixture({}, { fail: true });
  const failed = await g.setup.ensure();
  assert.equal(failed.status, 'failed');
  assert.doesNotMatch(JSON.stringify(failed), /raw private|app-secret/);
  await g.setup.ensure();
  assert.equal(g.calls.length, 1);
});

test('absent credentials preserve existing CLI configuration; incomplete credentials clearly fail without spawning', async () => {
  const existing = fixture({ appId: '', appSecret: '' });
  assert.equal(await existing.setup.ensure(), undefined);
  assert.equal(existing.calls.length, 0);
  for (const overrides of [{ appId: '' }, { appSecret: '' }, { appSecret: 'bad\nsecret' }]) {
    const f = fixture(overrides);
    assert.match((await f.setup.ensure()).reason, /App ID and App Secret/);
    assert.equal(f.calls.length, 0);
  }
});

test('caller cancellation does not duplicate or abort shared setup; disposal aborts host setup', async () => {
  const f = fixture({}, { pending: true }); const controller = new AbortController();
  const cancelled = f.setup.ensure(controller.signal);
  const other = f.setup.ensure();
  await Promise.resolve(); controller.abort();
  assert.equal((await cancelled).cancelled, true);
  assert.equal(f.calls[0].signal.aborted, false);
  f.release(); assert.equal(await other, undefined);
  const g = fixture({}, { pending: true });
  const pending = g.setup.ensure(); await Promise.resolve(); g.setup.dispose();
  assert.equal((await pending).status, 'unknown');
  assert.equal(g.calls[0].signal.aborted, true);
});

test('native schema keeps secret role, platform choices, and useful descriptions', () => {
  const fields = Config.dict;
  assert.equal(fields.appSecret.meta.role, 'secret');
  for (const name of ['appId', 'appSecret', 'brand', 'executable', 'cwd', 'timeoutMs', 'maxOutputBytes']) assert.ok(fields[name].meta.description);
  assert.equal(Config({}).get().brand, 'feishu');
  assert.equal(Config({ brand: 'lark' }).get().brand, 'lark');
  assert.throws(() => Config({ brand: 'other' }));
});
