import assert from 'assert';
import mock from 'mock-require-lazy';

describe('exports .ts', () => {
  it('mock', () => {
    assert.equal(typeof mock, 'function');
  });
});
