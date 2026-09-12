import assert from 'assert';
import Module from 'module';
import { fileURLToPath } from 'url';
import mock, { mockImport, mockRequire, reImport, stopAll } from 'mock-require-lazy';
import conditional from './conditional/run.mjs';

async function run() {
  const require = Module.createRequire(import.meta.url);
  const cjs = require('mock-require-lazy');
  assert.strictEqual(mock, cjs);
  assert.strictEqual(mock.require, mockRequire);
  assert.strictEqual(mock.import, mockImport);
  assert.strictEqual(mock.stopAll, stopAll);
  mockRequire('../exported-obj.cjs', { mocked: true }, { lazy: false });
  assert.strictEqual(require('../exported-obj.cjs').mocked, true);
  cjs.stopAll();
  assert.strictEqual(require('../exported-obj.cjs').mocked, false);

  const real = await import('./subject.mjs');
  assert.deepStrictEqual(real.output, ['real', 'real']);
  let calls = 0;
  await mockImport('./dep.mjs', () => {
    calls++;
    return { default: () => 'fake', value: 'fake' };
  }, { lazy: true, exports: ['default', 'value'] });
  assert.strictEqual(calls, 0);
  const pair = await Promise.all([mock.reImport('./subject.mjs'), reImport('./subject.mjs')]);
  assert.notStrictEqual(pair[0], pair[1]);
  pair.forEach((subject) => {
    assert.deepStrictEqual(subject.output, ['fake', 'fake']);
    assert.strictEqual(subject.identity, real.identity);
  });
  assert.strictEqual(calls, 1);
  cjs.stopAll();
  assert.deepStrictEqual((await reImport('./subject.mjs')).output, ['real', 'real']);
  assert.deepStrictEqual(pair[0].output, ['fake', 'fake']);

  await cjs.import('./dep.mjs', './named.mjs');
  const named = await import('./dep.mjs');
  assert.strictEqual(named.value, 'named-only');
  assert.strictEqual('default' in named, false);
  mock.stop('./dep.mjs');

  let retries = 0;
  await mock.import('./dep.mjs', () => {
    if (++retries === 1) throw new Error('factory failed');
    return { default: () => 'retry', value: 'retry' };
  }, { lazy: true, exports: ['default', 'value'] });
  await assert.rejects(reImport('./subject.mjs'), /factory failed/);
  assert.deepStrictEqual((await reImport('./subject.mjs')).output, ['retry', 'retry']);
  assert.strictEqual(retries, 2);
  stopAll();

  await mock.import(fileURLToPath(new URL('./dep.mjs', import.meta.url)), { value: 'absolute' });
  assert.strictEqual((await import('./dep.mjs')).value, 'absolute');
  mock.stop('./dep.mjs');
  assert.strictEqual((await import('./dep.mjs')).value, 'real');

  const cancelled = mock.import('./dep.mjs', { value: 'cancelled' });
  mock.stop('./dep.mjs');
  await cancelled;
  assert.deepStrictEqual((await reImport('./subject.mjs')).output, ['real', 'real']);
  const first = mock.import('./dep.mjs', { value: 'first' });
  const second = mock.import('./dep.mjs', { value: 'second' });
  await Promise.all([first, second]);
  assert.strictEqual((await import('./dep.mjs')).value, 'second');
  stopAll();

  await mock.import('./missing.mjs', { value: 'virtual' });
  assert.strictEqual((await import('./virtual.mjs')).output, 'virtual');
  mock.stop('./missing.mjs');
  await assert.rejects(import('./missing.mjs'), (error) => error.code === 'ERR_MODULE_NOT_FOUND');

  await mock.import('./dep.mjs?meaning=a%20b#one', { value: 'query' });
  assert.strictEqual((await import('./dep.mjs?meaning=a%20b#one')).value, 'query');
  assert.strictEqual((await import('./dep.mjs?meaning=a%20b#two')).value, 'real');
  stopAll();

  await mock.import('./dep.mjs', { default: undefined, value: undefined, class: 1 });
  const undefinedExports = await import('./dep.mjs');
  assert.strictEqual('default' in undefinedExports, true);
  assert.strictEqual(undefinedExports.default, undefined);
  assert.strictEqual(undefinedExports.class, 1);
  await assert.rejects(mock.import('./dep.mjs', () => ({})), /namespace object/);
  await assert.rejects(mock.import('./dep.mjs', () => ({}), { lazy: true }), /options.exports/);
  stopAll();

  await mock.import('./dep.mjs', './named.mjs');
  await assert.rejects(mock.import('./named.mjs', './dep.mjs'), /cycle/);
  stopAll();

  const fsFake = { readFileSync: () => 'fake-fs' };
  await mock.import('fs', { default: fsFake, readFileSync: fsFake.readFileSync });
  const fs = await import('node:fs');
  assert.strictEqual(fs.default, fsFake);
  assert.strictEqual(fs.readFileSync(), 'fake-fs');
  assert.notStrictEqual(require('fs'), fsFake);
  mock.stop('fs');
  assert.notStrictEqual((await import('node:fs')).default, fsFake);
  assert.strictEqual((await mock.reImport('fs')).default, require('fs'));

  const originalCjs = await import('../re-require-subject.cjs');
  const freshCjs = await reImport('../re-require-subject.cjs');
  assert.notStrictEqual(originalCjs.default, freshCjs.default);
  assert.strictEqual(originalCjs.default.dependency, freshCjs.default.dependency);

  await mock.import('../re-require-subject.cjs', { default: { mocked: true } });
  assert.strictEqual((await reImport('../re-require-subject.cjs')).default.mocked, true);
  stopAll();
  await conditional(mock);

  // A wrapper's parentURL resolves the registration, and the matching parentURL is required to stop it:
  // stopping from this file's own location (the default caller) must not reach a wrapper's registration.
  const wrapperParent = new URL('./conditional/run.mjs', import.meta.url).href;
  await mock('./import.mjs', { value: 'wrapper-both' }, { mode: 'both', parentURL: wrapperParent });
  assert.strictEqual((await import('./conditional/import.mjs')).value, 'wrapper-both');
  mock.stop('./import.mjs');
  assert.strictEqual((await import('./conditional/import.mjs')).value, 'wrapper-both');
  mock.stop('./import.mjs', { parentURL: wrapperParent });
  assert.strictEqual((await import('./conditional/import.mjs')).value, 'import-real');
  mock.require('./require.cjs', { value: 'wrapper-require' }, { parentURL: wrapperParent });
  assert.strictEqual(mock.reRequire('./require.cjs', { parentURL: wrapperParent }).value, 'wrapper-require');
  mock.stop('./require.cjs', { parentURL: wrapperParent });
  assert.strictEqual(mock.reRequire('./require.cjs', { parentURL: wrapperParent }).value, 'require-real');

  // mode: 'both' shares one registration between require() and native import().
  await mock('./dep.mjs', { value: 'both-object' }, { mode: 'both' });
  assert.strictEqual(require('./dep.mjs').value, 'both-object');
  assert.strictEqual((await import('./dep.mjs')).value, 'both-object');
  mock.stop('./dep.mjs');
  // A real .mjs file cannot be require()'d on every supported engine, so only import() proves restoration here.
  assert.strictEqual((await import('./dep.mjs')).value, 'real');
  stopAll();

  // The redirect target must be require()-compatible for a real load on every engine, unlike a genuine .mjs file.
  await mock('./dep.mjs', './replacement.cjs', { mode: 'both' });
  assert.strictEqual(require('./dep.mjs').value, 'redirected');
  assert.strictEqual((await import('./dep.mjs')).default.value, 'redirected');
  stopAll();

  let bothCalls = 0;
  await mock(
    './dep.mjs',
    () => {
      bothCalls++;
      if (bothCalls === 1) throw new Error('both factory failed');
      return { value: `both-${bothCalls}` };
    },
    { mode: 'both', lazy: true, exports: ['value'] }
  );
  assert.strictEqual(bothCalls, 0);
  assert.throws(() => require('./dep.mjs'), /both factory failed/);
  assert.strictEqual(bothCalls, 1);
  assert.strictEqual((await import('./dep.mjs')).value, 'both-2');
  assert.strictEqual(bothCalls, 2);
  assert.strictEqual(require('./dep.mjs').value, 'both-2');
  assert.strictEqual(bothCalls, 2);
  stopAll();

  let orderCalls = 0;
  await mock(
    './dep.mjs',
    () => {
      orderCalls++;
      return { value: `order-${orderCalls}` };
    },
    { mode: 'both', lazy: true, exports: ['value'] }
  );
  assert.strictEqual((await import('./dep.mjs')).value, 'order-1');
  assert.strictEqual(require('./dep.mjs').value, 'order-1');
  assert.strictEqual(orderCalls, 1);
  stopAll();

  const cancelledBoth = mock('./dep.mjs', { value: 'cancelled-both' }, { mode: 'both' });
  mock.stop('./dep.mjs');
  await cancelledBoth;
  assert.strictEqual((await import('./dep.mjs')).value, 'real');

  const stopAllPending = mock('./dep.mjs', { value: 'stopall-pending' }, { mode: 'both' });
  stopAll();
  await stopAllPending;
  assert.strictEqual((await import('./dep.mjs')).value, 'real');

  const firstBoth = mock('./dep.mjs', { value: 'first-both' }, { mode: 'both' });
  const secondBoth = mock('./dep.mjs', { value: 'second-both' }, { mode: 'both' });
  await Promise.all([firstBoth, secondBoth]);
  assert.strictEqual(require('./dep.mjs').value, 'second-both');
  assert.strictEqual((await import('./dep.mjs')).value, 'second-both');
  stopAll();

  const pendingBoth = mock('./dep.mjs', { value: 'both-before-require' }, { mode: 'both' });
  mock.require('./dep.mjs', { value: 'newer-require' });
  await pendingBoth;
  assert.strictEqual(require('./dep.mjs').value, 'newer-require');
  assert.strictEqual((await import('./dep.mjs')).value, 'both-before-require');
  stopAll();

  await assert.rejects(mock('./dep.mjs', () => 'callable', { mode: 'both' }), /use mock\.require or mock\.import/);
  assert.throws(() => mock('./dep.mjs', {}, { mode: 'invalid' }), /Unsupported mock mode/);
  assert.throws(() => mock.require('./dep.mjs', {}, { mode: 'both' }), /require-only/);
  assert.throws(() => mock.import('./dep.mjs', {}, { mode: 'both' }), /import-only/);
  mock.require('./dep.mjs', () => 'callable-result');
  assert.strictEqual(require('./dep.mjs')(), 'callable-result');
  stopAll();

  const versions = process.versions.node.split('.').map(Number);
  if (versions[0] > 22 || (versions[0] === 22 && (versions[1] > 22 || (versions[1] === 22 && versions[2] >= 3)))) {
    await mock.import('./dep.mjs', { value: 'required-esm' });
    assert.strictEqual(require('./required-subject.mjs').value, 'required-esm');
    mock.require('./required-subject.mjs', { value: 'require-replacement' });
    assert.strictEqual(require('./required-subject.mjs').value, 'require-replacement');
    stopAll();
  }

  if (Number(process.versions.node.split('.')[0]) >= 16) assert.strictEqual((await reImport('./tla.mjs')).value, 'awaited');
  console.log('mock-require-lazy integration complete');
}
run().catch((error) => { console.error(error); process.exitCode = 1; }).then(() => stopAll());
