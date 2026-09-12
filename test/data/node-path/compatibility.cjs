'use strict';

var assert = require('assert');
var mock = require('mock-require-lazy');

var immediateFake = { id: 'immediate-fake' };
mock('in-node-path', immediateFake);
assert.strictEqual(require('in-node-path'), immediateFake);
assert.strictEqual(require('./in-node-path.js'), immediateFake);
mock.stop('in-node-path');
assert.strictEqual(require('in-node-path'), require('./in-node-path.js'));
assert.strictEqual(require('in-node-path').id, 'node-path-set');

mock('in-node-path', function () {
  return { id: 'lazy-fake' };
}, true);
var lazyBare = require('in-node-path');
var lazyRelative = require('./in-node-path.js');
assert.strictEqual(lazyBare, lazyRelative);
assert.strictEqual(lazyBare.id, 'lazy-fake');
mock.stop('in-node-path');
assert.strictEqual(require('in-node-path'), require('./in-node-path.js'));
assert.strictEqual(require('in-node-path').id, 'node-path-set');

console.log('node-path cjs compatibility complete');
