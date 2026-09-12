'use strict';
var assert = require('assert');
require('ts-swc-loaders');
var mock = require('mock-require-lazy');
['ts', 'cts'].forEach(function (extension) {
  var subject = './commonjs/subject.' + extension;
  var dependency = './commonjs/dep.' + extension;
  assert.strictEqual(require(subject).read(), 'real-' + extension);
  var calls = 0;
  mock.require(dependency, function () { calls++; return { value: 'fake' }; }, { lazy: true });
  assert.strictEqual(calls, 0);
  assert.strictEqual(mock.reRequire(subject).read(), 'fake');
  assert.strictEqual(calls, 1);
  mock.stopAll();
  assert.strictEqual(mock.reRequire(subject).read(), 'real-' + extension);
});
console.log('mock-require-lazy integration complete');
