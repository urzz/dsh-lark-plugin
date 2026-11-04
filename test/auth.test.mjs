import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAuth } from '../lib/auth.js';

// Bare payloads match larksuite/cli tag v1.0.98:
// cmd/auth/{login.go,login_result.go,status.go,logout.go},
// internal/identitydiag/diagnostics.go. Never call a real auth command here.
const start = {
  verification_url: 'https://accounts.feishu.cn/oauth/v1/device/verify?user_code=USER-CODE',
  device_code: 'secret-device-code', expires_in: 600,
  hint: 'Deliver this URL, then wait for the user to confirm authorization.',
};
const complete = {
  event: 'authorization_complete', user_open_id: 'ou_example', user_name: 'Example User',
  scope: 'docx:document:readonly', requested: ['docx:document:readonly'],
  newly_granted: ['docx:document:readonly'], already_granted: [], missing: [],
  granted: ['docx:document:readonly'],
};
const status = {
  appId: 'cli_example', brand: 'feishu', defaultAs: 'auto', credentialSource: 'local',
  dpopMode: 'preferred', identity: 'user',
  identities: {
    bot: { status: 'ready', available: true, message: 'Bot identity: ready' },
    user: { status: 'ready', available: true, openId: 'ou_example', userName: 'Example User',
      tokenStatus: 'valid', scope: 'docx:document:readonly', expiresAt: '2026-11-04T12:00:00Z',
      message: 'User identity: ready' },
  },
};
const ok = data => ({ status: 'success', data });
function fake(...results) {
  const calls = [];
  const run = async (...args) => {
    calls.push(args);
    const result = results.shift();
    if (result instanceof Error) throw result;
    assert.ok(result, 'unexpected CLI invocation');
    return result;
  };
  return { run, calls };
}

test('start returns original URL and expiry, completes with private code once', async t => {
  const runner = fake(ok(start), ok(complete));
  const auth = createAuth(runner.run);
  t.after(() => auth.dispose());
  const signal = new AbortController().signal;
  const first = await auth.execute({ action: 'login_start' }, signal);
  assert.equal(first.status, 'success');
  assert.match(first.data.flow_id, /^[0-9a-f-]{36}$/);
  assert.equal(first.data.verification_url, start.verification_url);
  assert.equal(first.data.expires_in, 600);
  assert.ok(Date.parse(first.data.expires_at) > Date.now());
  assert.deepEqual(Object.keys(first.data).sort(), ['expires_at', 'expires_in', 'flow_id', 'verification_url']);
  assert.ok(!JSON.stringify(first).includes(start.device_code));
  assert.deepEqual(runner.calls[0], [['auth', 'login', '--domain', 'docs', '--domain', 'drive', '--domain', 'sheets', '--domain', 'base', '--no-wait', '--json'], undefined, signal]);
  const result = await auth.execute({ action: 'login_complete', flow_id: first.data.flow_id });
  assert.equal(result.status, 'success');
  assert.equal(result.data.user_open_id, 'ou_example');
  assert.deepEqual(runner.calls[1][0], ['auth', 'login', '--device-code', start.device_code, '--json']);
  const replay = await auth.execute({ action: 'login_complete', flow_id: first.data.flow_id });
  assert.equal(replay.error.code, 'invalid_auth_flow');
  assert.equal(runner.calls.length, 2);
});

test('status projects nested identity fields and strips secrets and diagnostics', async t => {
  const secrets = { access_token: 'ACCESS-SECRET', refreshToken: 'REFRESH-SECRET', app_secret: 'APP-SECRET', device_code: 'DEVICE-SECRET' };
  const payload = structuredClone(status);
  payload.identities.user.message = Object.values(secrets).join(' ');
  payload.identities.user.error = { detail: Object.values(secrets).join(' '), nested: [secrets] };
  payload.identities.user.userName = 'Example ACCESS-SECRET';
  payload.verifyError = 'APP-SECRET';
  payload.note = 'REFRESH-SECRET';
  const runner = fake(ok(payload));
  const auth = createAuth(runner.run);
  t.after(() => auth.dispose());
  const result = await auth.execute({ action: 'status', verify: true });
  assert.equal(result.status, 'success');
  assert.deepEqual(runner.calls[0][0], ['auth', 'status', '--json', '--verify']);
  assert.equal(result.data.identities.user.userName, 'Example [REDACTED]');
  for (const secret of Object.values(secrets)) assert.ok(!JSON.stringify(result).includes(secret));
  assert.equal(result.data.identities.user.message, undefined);
  assert.equal(result.data.identities.user.error, undefined);
});

test('completion removes arbitrary nested fields, warning diagnostics and known code echoes', async t => {
  const payload = { ...complete, user_name: `Name ${start.device_code}`, warning: { type: 'missing_scope', hint: 'APP-SECRET' }, nested: [{ app_secret: 'APP-SECRET', refresh_token: 'REFRESH-SECRET' }] };
  const runner = fake(ok(start), ok(payload));
  const auth = createAuth(runner.run);
  t.after(() => auth.dispose());
  const flow = (await auth.execute({ action: 'login_start' })).data.flow_id;
  const result = await auth.execute({ action: 'login_complete', flow_id: flow });
  assert.equal(result.data.user_name, 'Name [REDACTED]');
  assert.equal(result.data.warning, undefined);
  assert.ok(!JSON.stringify(result).includes('APP-SECRET'));
});

test('flow expires and cannot be resumed', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1_800_000_000_000 });
  const runner = fake(ok({ ...start, expires_in: 1 }));
  const auth = createAuth(runner.run);
  t.after(() => auth.dispose());
  const flow = (await auth.execute({ action: 'login_start' })).data.flow_id;
  t.mock.timers.tick(1000);
  assert.equal((await auth.execute({ action: 'login_complete', flow_id: flow })).error.code, 'invalid_auth_flow');
  assert.equal(runner.calls.length, 1);
});

test('logout clears flows even if CLI logout fails', async t => {
  const runner = fake(ok(start), { status: 'failed', data: { error: 'secret-device-code' }, stderr: 'REFRESH-SECRET' });
  const auth = createAuth(runner.run);
  t.after(() => auth.dispose());
  const flow = (await auth.execute({ action: 'login_start' })).data.flow_id;
  const result = await auth.execute({ action: 'logout' });
  assert.equal(result.status, 'failed');
  assert.ok(!JSON.stringify(result).includes('SECRET'));
  assert.deepEqual(runner.calls[1][0], ['auth', 'logout', '--json']);
  assert.equal((await auth.execute({ action: 'login_complete', flow_id: flow })).error.code, 'invalid_auth_flow');
});

test('logout accepts exact idempotent CLI fixtures', async t => {
  for (const payload of [{ ok: true, loggedOut: true }, { ok: true, loggedOut: false, reason: 'not_configured' }, { ok: true, loggedOut: false, reason: 'not_logged_in' }]) {
    const auth = createAuth(fake(ok(payload)).run);
    t.after(() => auth.dispose());
    const result = await auth.execute({ action: 'logout' });
    assert.equal(result.status, 'success');
    assert.equal(result.data.loggedOut, payload.loggedOut);
  }
});

test('unknown outcomes and thrown runner diagnostics never leak; attempted flows are consumed', async t => {
  for (const outcome of [{ status: 'unknown', data: complete, stderr: 'APP-SECRET' }, new Error('argv --device-code secret-device-code stderr ACCESS-SECRET')]) {
    const runner = fake(ok(start), outcome);
    const auth = createAuth(runner.run);
    t.after(() => auth.dispose());
    const flow = (await auth.execute({ action: 'login_start' })).data.flow_id;
    const result = await auth.execute({ action: 'login_complete', flow_id: flow });
    assert.equal(result.status, 'unknown');
    assert.ok(!JSON.stringify(result).includes('SECRET'));
    assert.ok(!JSON.stringify(result).includes(start.device_code));
    assert.equal((await auth.execute({ action: 'login_complete', flow_id: flow })).error.code, 'invalid_auth_flow');
  }
});

test('unknown JSON shapes and wrong field types fail closed', async t => {
  const cases = [
    ['login_start', { data: start }], ['login_start', { ...start, expires_in: '600' }],
    ['login_start', { ...start, verification_url: 'javascript:alert(1)' }],
    ['login_start', { ...start, verification_url: `https://example.com/?device_code=${start.device_code}` }],
    ['status', { ok: true }], ['status', { ...status, identities: { user: {}, bot: {} } }],
    ['logout', { ok: true }],
  ];
  for (const [action, payload] of cases) {
    const auth = createAuth(fake(ok(payload)).run);
    t.after(() => auth.dispose());
    assert.equal((await auth.execute({ action })).status, 'unknown');
  }
});

test('missing scopes retain failed runner status with safe identity fields', async t => {
  const runner = fake(ok(start), { status: 'failed', data: { ...complete, missing: ['drive:file:readonly'], warning: { type: 'missing_scope', hint: 'ACCESS-SECRET' } } });
  const auth = createAuth(runner.run);
  t.after(() => auth.dispose());
  const flow = (await auth.execute({ action: 'login_start' })).data.flow_id;
  const result = await auth.execute({ action: 'login_complete', flow_id: flow });
  assert.equal(result.status, 'failed');
  assert.equal(result.data.event, 'authorization_complete');
  assert.deepEqual(result.data.missing, ['drive:file:readonly']);
  assert.ok(!JSON.stringify(result).includes('ACCESS-SECRET'));
});

test('all auth calls serialize and disposal prevents queued calls and stale flow retention', async () => {
  let release;
  const calls = [];
  const auth = createAuth(async argv => {
    calls.push(argv);
    await new Promise(resolve => { release = resolve; });
    return ok(start);
  });
  const pending = auth.execute({ action: 'login_start' });
  const queued = auth.execute({ action: 'status' });
  await Promise.resolve();
  assert.equal(calls.length, 1);
  auth.dispose();
  release();
  assert.equal((await pending).status, 'unknown');
  assert.equal((await queued).error.code, 'auth_disposed');
  assert.equal(calls.length, 1);
});

test('an aborted queued call does not execute the CLI or leak abort reason', async t => {
  const runner = fake();
  const auth = createAuth(runner.run);
  t.after(() => auth.dispose());
  const controller = new AbortController();
  controller.abort(new Error('ACCESS-SECRET'));
  const result = await auth.execute({ action: 'status' }, controller.signal);
  assert.equal(result.status, 'unknown');
  assert.ok(!JSON.stringify(result).includes('ACCESS-SECRET'));
  assert.equal(runner.calls.length, 0);
});
