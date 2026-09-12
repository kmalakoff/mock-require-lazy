import assert from 'assert';
import Module from 'module';
import readCopy from '../conditional-copy/read.mjs';

export default async function run(mock) {
  const require = Module.createRequire(import.meta.url);
  assert.strictEqual(require('mrl-conditional-fixture').value, 'require-real');
  assert.strictEqual((await import('mrl-conditional-fixture')).value, 'import-real');
  mock.require('mrl-conditional-fixture', { value: 'require-fake' });
  await mock.import('mrl-conditional-fixture', { value: 'import-fake' });
  assert.strictEqual(require('mrl-conditional-fixture').value, 'require-fake');
  assert.strictEqual((await import('mrl-conditional-fixture')).value, 'import-fake');
  assert.deepStrictEqual(await readCopy(), ['copy-require', 'copy-import']);
  mock.stop('mrl-conditional-fixture');
  assert.strictEqual(require('mrl-conditional-fixture').value, 'require-real');
  assert.strictEqual((await import('mrl-conditional-fixture')).value, 'import-real');
  await mock.import('mrl-conditional-fixture/import-only', { value: 'only-fake' });
  assert.strictEqual((await import('mrl-conditional-fixture/import-only')).value, 'only-fake');
  mock.stop('mrl-conditional-fixture/import-only');
  assert.strictEqual((await import('mrl-conditional-fixture/import-only')).value, 'only-real');
}
