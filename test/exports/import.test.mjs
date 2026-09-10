import assert from 'assert';
import mock from 'mock-require-lazy';

describe('exports .mjs', () => {
  it('mock', () => {
    assert.equal(typeof mock, 'function');
  });
});
