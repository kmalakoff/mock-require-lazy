import Module from 'module';
import { dirname, join } from 'path';
import url from 'url';
import child from '../lib/child.ts';

const _require = typeof require === 'undefined' ? Module.createRequire(import.meta.url) : require;
const directory = typeof __dirname === 'undefined' ? dirname(url.fileURLToPath(import.meta.url)) : __dirname;
const major = Number(process.versions.node.split('.')[0]);

if (major >= 12) {
  const loader = url.pathToFileURL(_require.resolve('mock-require-lazy/loader')).href;
  describe('native ESM integration', () => {
    it('shares package state and implements lazy import with shallow refresh', (done) => {
      const args = typeof Module.register === 'function' || typeof Module.registerHooks === 'function' ? [] : ['--loader', loader];
      args.push(join(directory, '..', 'data', 'esm', 'run.mjs'));
      child(args, done);
    });
    it('supports startup registration', (done) => {
      child(['--loader', loader, join(directory, '..', 'data', 'esm', 'run.mjs')], done);
    });
  });
}
