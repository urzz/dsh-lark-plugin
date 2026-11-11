import assert from 'node:assert/strict';
import test from 'node:test';
import { apply, Config } from '../lib/index.js';
import { Context } from '@deepseek-ai/cordis';

function mount(config = {}, setupFails = false, behavior = {}) {
  const tools = new Map(); const disposers = []; let provider; const calls = [];
  const events = new Map(); const settingsCalls = []; const specs = [];
  const remote = new Context();
  let value = Config({ executable: 'lark-cli', ...config }).get();
  const ctx = {
    tools: { register(tool) { tools.set(tool.name, tool); } },
    skills: { registerProvider(create) { provider = create({}); } },
    effect(fn) { disposers.push(fn()); },
    fiber: { id: 'lark-test' },
    on(event, listener) { events.set(event, listener); },
    inject(names, callback) {
      if (names[0] === 'typert') { if (config.withConnection) callback(remote); return; }
      assert.deepEqual(names, ['settings']);
      if (!config.withSettings) return;
      callback({ effect: this.effect, settings: { configure(options, fiber) { settingsCalls.push({ options, fiber }); return () => {}; } } });
    },
    subprocess: {
      async resolveExecutable(executable) { return executable; },
      spawn(spec) {
        calls.push(spec.argv); specs.push(spec);
        const auth = spec.argv[1] === 'auth';
        const config = spec.argv[1] === 'config';
        const stdout = auth ? behavior.authData ? JSON.stringify(behavior.authData) : '' : 'help text';
        const stderr = auth ? JSON.stringify({ok:false,error:{type:'config',subtype:'not_configured',message:'never expose raw diagnostic secret'}}) : '';
        const stream = text => ({ readFrom() { return {text,nextOffset:Buffer.byteLength(text),lossy:false}; } });
        const done = behavior.pending ? new Promise(resolve => spec.signal.addEventListener('abort', () => resolve({ exitCode: null, signal: 'SIGTERM' }), { once: true }))
          : Promise.resolve({exitCode:(auth && !behavior.authData) || (config && setupFails)?3:0,signal:null});
        return { done,collected:{stdout:stream(stdout),stderr:stream(stderr)} };
      },
    },
  };
  apply(ctx, { get: () => value });
  return {tools,provider,calls,settingsCalls,specs,remote,
    update(next) { value = Config({ ...value, ...next }).get(); events.get('loader/volatile-update')([[]]); },
    dispose(){for(const dispose of disposers)dispose();}};
}

test('registered auth uses private runner and returns actionable configuration error without raw diagnostics', async () => {
  const app = mount();
  const result = await app.tools.get('lark_auth').execute({action:'status'},{});
  assert.equal(result.error.code,'not_configured');
  assert.deepEqual(app.calls[0].slice(1),['auth','status','--json']);
  assert.doesNotMatch(JSON.stringify(result),/raw diagnostic secret/);
  app.dispose();
  assert.equal((await app.tools.get('lark_auth').execute({action:'status'},{})).error.code,'auth_disposed');
});

test('registered business tool cannot use private auth bypass and help executes literally', async () => {
  const app = mount(); const tool = app.tools.get('lark_cli');
  assert.equal((await tool.execute({args:['auth','login']},{})).status,'failed');
  assert.equal(app.calls.length,0);
  assert.equal((await tool.execute({args:['sheets','--help']},{})).stdout,'help text');
  assert.deepEqual(app.calls[0].slice(1),['sheets','--help','--as','user']);
  app.dispose();
});

test('host initialization failure blocks both tools and config is never model callable', async () => {
  const app = mount({ appId: 'cli_app', appSecret: 'secret' }, true);
  const cli = app.tools.get('lark_cli');
  assert.equal((await cli.execute({ args: ['config', 'init'] }, {})).status, 'failed');
  assert.equal(app.calls.length, 0);
  const results = await Promise.all([
    cli.execute({ args: ['sheets', '--help'] }, {}),
    app.tools.get('lark_auth').execute({ action: 'status' }, {}),
  ]);
  for (const result of results) {
    assert.equal(result.status, 'failed');
    assert.match(result.reason, /initialization failed/);
    assert.doesNotMatch(JSON.stringify(result), /raw diagnostic/);
  }
  assert.equal(app.calls.length, 1);
  assert.equal(app.calls[0][1], 'config');
  app.dispose();
});

test('business and auth calls share successful setup before their commands', async () => {
  const app = mount({ appId: 'cli_app', appSecret: 'secret' });
  await Promise.all([
    app.tools.get('lark_cli').execute({ args: ['sheets', '--help'] }, {}),
    app.tools.get('lark_auth').execute({ action: 'status' }, {}),
  ]);
  assert.deepEqual(app.calls.map(argv => argv[1]), ['config', 'sheets', 'auth']);
  await app.tools.get('lark_cli').execute({ args: ['schema', '--help'] }, {});
  for (const argv of app.calls) assert.deepEqual(argv.slice(-2), ['--profile', 'dsh-lark-plugin']);
  assert.deepEqual(app.calls[0].slice(1, 5), ['config', 'init', '--name', 'dsh-lark-plugin']);
  app.dispose();
});

test('live root configuration recreates setup and tools route with latest configuration', async () => {
  const app = mount({ withSettings: true });
  const cli = app.tools.get('lark_cli'); const auth = app.tools.get('lark_auth');
  await cli.execute({ args: ['--version'] }, {});
  assert.deepEqual(app.calls[0], ['lark-cli', '--version']);
  app.update({ appId: 'cli_new', appSecret: 'replacement', executable: 'other-cli' });
  await cli.execute({ args: ['--version'] }, {});
  await auth.execute({ action: 'status' }, {});
  assert.deepEqual(app.calls.slice(1).map(argv => argv[0]), ['other-cli', 'other-cli', 'other-cli']);
  assert.equal(app.calls[1][app.calls[1].indexOf('--app-id') + 1], 'cli_new');
  assert.equal(app.calls.filter(argv => argv[1] === 'config').length, 1);
  for (const argv of app.calls.slice(1)) assert.deepEqual(argv.slice(-2), ['--profile', 'dsh-lark-plugin']);
  app.update({ appId: '', appSecret: '' });
  await cli.execute({ args: ['--version'] }, {});
  assert.deepEqual(app.calls.at(-1), ['other-cli', '--version']);
  assert.deepEqual(app.settingsCalls, [{ options: { auto: false }, fiber: { id: 'lark-test' } }]);
  app.dispose();
});

test('live configuration aborts pending setup, auth and business work from the old configuration', async () => {
  for (const command of ['config', 'auth', 'sheets']) {
    const behavior = { pending: true };
    const app = mount(command === 'config' ? { appId: 'old_app', appSecret: 'old_secret' } : {}, false, behavior);
    const pending = command === 'auth'
      ? app.tools.get('lark_auth').execute({ action: 'status' }, {})
      : app.tools.get('lark_cli').execute({ args: ['sheets', '--help'] }, {});
    // The fake subprocess must be running before replacing configuration.
    while (!app.specs.length) await Promise.resolve();
    behavior.pending = false;
    app.update({ appId: 'new_app', appSecret: 'new_secret' });
    assert.equal(app.specs[0].signal.aborted, true);
    assert.notEqual((await pending).status, 'success');
    await app.tools.get('lark_cli').execute({ args: ['--version'] }, {});
    const init = app.calls.findLast(argv => argv[1] === 'config');
    assert.equal(init[init.indexOf('--app-id') + 1], 'new_app');
    app.dispose();
  }
});

test('configuration connection test initializes saved settings and verifies user authorization online', async () => {
  for (const [user, expected] of [
    [{ status: 'ready', available: true, verified: true }, 'connected'],
    [{ status: 'ready', available: true }, 'verification_failed'],
    [{ status: 'missing', available: false }, 'not_authorized'],
    [{ status: 'verify_failed', available: false, verified: false }, 'verification_failed'],
    [{ status: 'not_configured', available: false }, 'not_configured'],
  ]) {
    const app = mount({ withConnection: true, appId: 'cli_app', appSecret: 'private-secret' }, false, {
      authData: { identity: 'bot', identities: { bot: { status: 'ready', available: true, verified: true }, user } },
    });
    assert.deepEqual(await app.remote.larkConnection.test(), { status: expected });
    assert.deepEqual(app.calls.map(argv => argv[1]), ['config', 'auth']);
    assert.deepEqual(app.calls[1].slice(1), ['auth', 'status', '--json', '--verify', '--profile', 'dsh-lark-plugin']);
    app.dispose();
  }
  const app = mount({ withConnection: true, appId: 'cli_app', appSecret: 'private-secret' }, true);
  assert.deepEqual(await app.remote.larkConnection.test(), { status: 'setup_failed' });
  assert.equal(app.calls.length, 1);
  app.dispose();
});

test('registered provider loads packaged skill and guidance', async () => {
  const app = mount(); const [candidate] = await app.provider.list({});
  assert.equal(candidate.name,'lark-workspace');
  const skill = await app.provider.get(candidate,{});
  assert.match(skill.content,/cells-set/);
  assert.match(skill.content,/login_complete/);
  app.dispose();
});
