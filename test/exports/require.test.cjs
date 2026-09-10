const assert = require('assert');
const mock = require('mock-require-lazy');

describe('exports .cjs', () => {
  it('mock', () => {
    assert.equal(typeof mock, 'function');
  });
});
