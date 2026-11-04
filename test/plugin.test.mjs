import assert from 'node:assert/strict';
import test from 'node:test';
import { apply, Config } from '../lib/index.js';

function mount() {
  const tools = new Map(); const disposers = []; let provider; const calls = [];
  const ctx = {
    tools: { register(tool) { tools.set(tool.name, tool); } },
    skills: { registerProvider(create) { provider = create({}); } },
    effect(fn) { disposers.push(fn()); },
    subprocess: {
      async resolveExecutable(executable) { return executable; },
      spawn(spec) {
        calls.push(spec.argv);
        const auth = spec.argv[1] === 'auth';
        const stdout = auth ? '' : 'help text';
        const stderr = auth ? JSON.stringify({ok:false,error:{type:'config',subtype:'not_configured',message:'never expose raw diagnostic secret'}}) : '';
        const stream = text => ({ readFrom() { return {text,nextOffset:Buffer.byteLength(text),lossy:false}; } });
        return { done:Promise.resolve({exitCode:auth?3:0,signal:null}),collected:{stdout:stream(stdout),stderr:stream(stderr)} };
      },
    },
  };
  apply(ctx, Config({}));
  return {tools,provider,calls,dispose(){for(const dispose of disposers)dispose();}};
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

test('registered provider loads packaged skill and guidance', async () => {
  const app = mount(); const [candidate] = await app.provider.list({});
  assert.equal(candidate.name,'lark-workspace');
  const skill = await app.provider.get(candidate,{});
  assert.match(skill.content,/cells-set/);
  assert.match(skill.content,/login_complete/);
  app.dispose();
});
