import { dirname, join } from 'path';
import url from 'url';
import child from '../lib/child.ts';

const directory = typeof __dirname === 'undefined' ? dirname(url.fileURLToPath(import.meta.url)) : __dirname;
if (Number(process.versions.node.split('.')[0]) >= 12) {
  describe('exports ./loader', () => {
    it('exposes native ESM loader hooks', (done) => {
      child([join(directory, '..', 'data', 'esm', 'loader-smoke.mjs')], done);
    });
  });
}
