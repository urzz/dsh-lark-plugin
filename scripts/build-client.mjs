import { build } from 'esbuild';

// DSH shares React through __ModuleLoader__; never bundle a second React copy.
await build({
  entryPoints: ['client/index.ts'], outfile: 'lib/client.js', bundle: true,
  format: 'cjs', platform: 'browser', target: 'es2022', jsx: 'automatic',
  external: ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
  loader: { '.css': 'text' },
  banner: { js: 'window.__ModuleLoader__.load({id:"dsh-lark-plugin",factory(require){\nconst module={exports:{}};const exports=module.exports;' },
  footer: { js: 'return module.exports;\n}});' },
});
