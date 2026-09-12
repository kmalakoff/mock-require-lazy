import assert from 'assert';
import { resolve, load, getFormat, getSource } from 'mock-require-lazy/loader';
assert.strictEqual(typeof resolve, 'function');
assert.strictEqual(typeof load, 'function');
const versions = process.versions.node.split('.').map(Number);
const legacy = versions[0] < 16 || (versions[0] === 16 && versions[1] < 12);
assert.strictEqual(typeof getFormat, legacy ? 'function' : 'undefined');
assert.strictEqual(typeof getSource, legacy ? 'function' : 'undefined');
console.log('mock-require-lazy integration complete');
