import Module from 'module';
import { dirname, join } from 'path';
import url from 'url';
import child from '../lib/child.ts';

const _require = typeof require === 'undefined' ? Module.createRequire(import.meta.url) : require;
const directory = typeof __dirname === 'undefined' ? dirname(url.fileURLToPath(import.meta.url)) : __dirname;
const fixture = join(directory, '..', 'data', 'typed');
const versions = process.versions.node.split('.').map(Number);

describe('TypeScript integration', () => {
  it('mocks and restores typed .ts and .cts CommonJS subjects', (done) => {
    child([join(fixture, 'require.cjs')], done, { cwd: fixture });
  });

  if (versions[0] >= 12 && !(versions[0] === 16 && versions[1] < 12)) {
    it('mocks and restores real .ts/.mts imports and an imported .cts subject', (done) => {
      const cli = join(dirname(_require.resolve('ts-swc-loaders/package.json')), 'bin', 'cli.js');
      const args = typeof Module.register === 'function' || typeof Module.registerHooks === 'function' ? [cli, 'node', join(fixture, 'import.mjs')] : ['--loader', url.pathToFileURL(join(fixture, 'loader.mjs')).href, join(fixture, 'import.mjs')];
      child(args, done, { cwd: fixture });
    });
  }
});
