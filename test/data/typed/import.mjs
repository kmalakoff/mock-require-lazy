import assert from 'assert';
import Module from 'module';
import mock from 'mock-require-lazy';

async function run() {
  for (const extension of ['ts', 'mts']) {
    const subject = './module/subject.' + extension;
    const dependency = './module/dep.' + extension;
    assert.strictEqual((await import(subject)).read(), 'real-' + extension);
    let calls = 0;
    await mock.import(dependency, () => { calls++; return { value: 'fake' }; }, { lazy: true, exports: ['value'] });
    assert.strictEqual(calls, 0);
    assert.strictEqual((await mock.reImport(subject)).read(), 'fake');
    assert.strictEqual((await import('./module/dep.js')).value, 'real-js');
    assert.strictEqual(calls, 1);
    mock.stopAll();
    assert.strictEqual((await mock.reImport(subject)).read(), 'real-' + extension);
  }
  const require = Module.createRequire(import.meta.url);
  if (typeof Module.register === 'function' || typeof Module.registerHooks === 'function') {
    await mock.import('./module/remapped.js', { value: 'remapped-fake' });
    assert.strictEqual((await import('./module/remapped.ts')).value, 'remapped-fake');
    mock.stop('./module/remapped.js');
    assert.strictEqual((await import('./module/remapped.ts')).value, 'real-remapped');
  }
  require('ts-swc-loaders');
  const cts = await mock.reImport('./commonjs/native-subject.cts');
  assert.strictEqual(cts.default.read(), 'real-cts');
  assert.strictEqual((await import('./commonjs/native-subject.cts')).default, cts.default);
  mock.require('./commonjs/dep.cts', { value: 'fake-cts' });
  assert.strictEqual((await mock.reImport('./commonjs/native-subject.cts')).default.read(), 'fake-cts');
  mock.stopAll();
  assert.strictEqual((await mock.reImport('./commonjs/native-subject.cts')).default.read(), 'real-cts');
  console.log('mock-require-lazy integration complete');
}
run().catch((error) => { console.error(error); process.exitCode = 1; }).then(() => mock.stopAll());
