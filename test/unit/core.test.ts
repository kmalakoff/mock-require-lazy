import assert from 'assert';
import mock from 'mock-require-lazy';
import Module from 'module';

const _require = typeof require === 'undefined' ? Module.createRequire(import.meta.url) : require;

describe('Mock Require', () => {
  afterEach(() => {
    mock.stopAll();
  });

  it('handles virtual names that are object prototype keys', () => {
    const immediate = { value: 'immediate' };
    mock('__proto__', immediate);
    assert.strictEqual(_require('__proto__'), immediate);
    mock.stop('__proto__');
    const lazy = { value: 'lazy' };
    mock('__proto__', () => lazy, true);
    assert.strictEqual(_require('__proto__'), lazy);
  });

  if (Number(process.versions.node.split('.')[0]) >= 18) {
    it('aliases ordinary builtins without aliasing prefix-only builtins', () => {
      const fake = { value: 'mocked' };
      mock('fs', fake);
      assert.strictEqual(_require('node:fs'), fake);
      mock('test', fake);
      assert.notStrictEqual(_require('node:test'), fake);
    });
  }

  describe('immediate', () => {
    it('should mock a required function', () => {
      mock('../data/exported-fn.cjs', () => 'mocked fn');

      assert.equal(_require('../data/exported-fn.cjs')(), 'mocked fn');
    });

    it('should mock a required object', () => {
      mock('../data/exported-obj.cjs', {
        mocked: true,
        fn: () => 'mocked obj',
      });

      let obj = _require('../data/exported-obj.cjs');
      assert.equal(obj.fn(), 'mocked obj');
      assert.equal(obj.mocked, true);

      mock.stop('../data/exported-obj.cjs');

      obj = _require('../data/exported-obj.cjs');
      assert.equal(obj.fn(), 'exported object');
      assert.equal(obj.mocked, false);
    });

    it('should unmock', () => {
      mock('../data/exported-fn.cjs', () => 'mocked fn');

      mock.stop('../data/exported-fn.cjs');

      const fn = _require('../data/exported-fn.cjs');
      assert.equal(fn(), 'exported function');
    });

    it('should mock a root file', () => {
      mock('../..', { mocked: true });
      assert.equal(_require('../..').mocked, true);
    });

    it('should mock a standard lib', () => {
      mock('fs', { mocked: true });

      const fs = _require('fs');
      assert.equal(fs.mocked, true);
    });

    it('should mock an external lib', () => {
      mock('mocha', { mocked: true });

      const mocha = _require('mocha');
      assert.equal(mocha.mocked, true);
    });

    it('should one lib with another', () => {
      mock('fs', 'path');
      assert.equal(_require('fs'), _require('path'));

      mock('../data/exported-fn.cjs', '../data/exported-obj.cjs');
      assert.equal(_require('../data/exported-fn.cjs'), _require('../data/exported-obj.cjs'));
    });

    it('should support re-requiring', () => {
      assert.equal(mock.reRequire('../data/index.cjs'), 'root');
    });

    it('should re-require only the subject', () => {
      const first = _require('../data/re-require-subject.cjs') as { dependency: unknown };
      const second = mock.reRequire('../data/re-require-subject.cjs') as { dependency: unknown };

      assert.notEqual(second, first);
      assert.strictEqual(second.dependency, first.dependency);
    });

    it('should cascade mocks', () => {
      mock('path', { mocked: true });
      mock('fs', 'path');

      const fs = _require('fs');
      assert.equal(fs.mocked, true);
    });

    it('should never require the real lib when mocking it', () => {
      mock('../data/throw-exception.cjs', {});
      _require('../data/throw-exception.cjs');
    });

    it('should mock libs required elsewhere', () => {
      mock('../data/throw-exception.cjs', {});
      _require('../data/throw-exception-runner.cjs');
    });

    it('should only load the mocked lib when it is required', () => {
      mock('../data/throw-exception.cjs', '../data/throw-exception-when-required.cjs');
      try {
        _require('../data/throw-exception-runner.cjs');
        throw new Error('this line should never be executed.');
      } catch (error) {
        assert.equal((error as Error).message, 'this should run when required');
      }
    });

    it('should stop all mocks', () => {
      mock('fs', {});
      mock('path', {});
      const fsMock = _require('fs');
      const pathMock = _require('path');

      mock.stopAll();

      assert.notEqual(_require('fs'), fsMock);
      assert.notEqual(_require('path'), pathMock);
    });

    it('should mock a module that does not exist', () => {
      mock('a', { id: 'a' });

      assert.equal(_require('a').id, 'a');
    });

    it('should mock multiple modules that do not exist', () => {
      mock('a', { id: 'a' });
      mock('b', { id: 'b' });
      mock('c', { id: 'c' });

      assert.equal(_require('a').id, 'a');
      assert.equal(_require('b').id, 'b');
      assert.equal(_require('c').id, 'c');
    });

    it('should mock a local file that does not exist', () => {
      mock('../data/a.cjs', { id: 'a' });
      assert.equal(_require('../data/a.cjs').id, 'a');

      mock('../a.cjs', { id: 'a' });
      assert.equal(_require('../a.cjs').id, 'a');
    });

    it('should mock a local file required elsewhere', () => {
      mock('../data/x.cjs', { id: 'x' });
      assert.equal(_require('../data/nested/module-c.cjs').dependentOn.id, 'x');
    });

    it('should mock multiple local files that do not exist', () => {
      mock('../data/a.cjs', { id: 'a' });
      mock('../data/b.cjs', { id: 'b' });
      mock('../data/c.cjs', { id: 'c' });

      assert.equal(_require('../data/a.cjs').id, 'a');
      assert.equal(_require('../data/b.cjs').id, 'b');
      assert.equal(_require('../data/c.cjs').id, 'c');
    });

    it('should unmock a module that is not found', () => {
      const moduleName = 'module-that-is-not-installed';

      mock(moduleName, { mocked: true });
      mock.stop(moduleName);

      try {
        _require(moduleName);
        throw new Error('this line should never be executed.');
      } catch (e) {
        assert.equal((e as NodeJS.ErrnoException).code, 'MODULE_NOT_FOUND');
      }
    });

    it('should differentiate between local files and external modules with the same name', () => {
      mock('module-a', { id: 'external-module-a' });

      const b = _require('../data/module-b.cjs');

      assert.equal(b.dependentOn.id, 'local-module-a');
      assert.equal(b.dependentOn.dependentOn.id, 'external-module-a');
    });

    it('should share mocks across equivalent relative requests', () => {
      const fake = { id: 'mocked' };
      mock('../data/node-path/in-node-path.js', fake);

      const explicit = _require('../data/node-path/in-node-path.js');
      const implicit = _require('../data/./node-path/in-node-path');

      assert.strictEqual(explicit, fake);
      assert.strictEqual(implicit, fake);
    });

    it('should return primitive mock values', () => {
      mock('primitive-false', false);
      mock('primitive-zero', 0);
      mock('primitive-null', null);
      mock('primitive-undefined', undefined);

      assert.strictEqual(_require('primitive-false'), false);
      assert.strictEqual(_require('primitive-zero'), 0);
      assert.strictEqual(_require('primitive-null'), null);
      assert.strictEqual(_require('primitive-undefined'), undefined);
    });
  });

  describe('lazy', () => {
    it('should mock a required function', () => {
      mock('../data/exported-fn.cjs', () => () => 'mocked fn', true);

      assert.equal(_require('../data/exported-fn.cjs')(), 'mocked fn');
    });

    it('should mock a standard lib', () => {
      mock('fs', () => ({ mocked: true }), true);

      const fs = _require('fs');
      assert.equal(fs.mocked, true);
    });

    it('should mock a required object', () => {
      mock(
        '../data/exported-obj.cjs',
        () => ({
          mocked: true,
          fn: () => 'mocked obj',
        }),
        true
      );

      let obj = _require('../data/exported-obj.cjs');
      assert.equal(obj.fn(), 'mocked obj');
      assert.equal(obj.mocked, true);

      mock.stop('../data/exported-obj.cjs');

      obj = _require('../data/exported-obj.cjs');
      assert.equal(obj.fn(), 'exported object');
      assert.equal(obj.mocked, false);
    });

    it('should unmock', () => {
      mock('../data/exported-fn.cjs', () => 'mocked fn', true);

      mock.stop('../data/exported-fn.cjs');

      const fn = _require('../data/exported-fn.cjs');
      assert.equal(fn(), 'exported function');
    });

    it('should mock a root file', () => {
      mock('../..', () => ({ mocked: true }), true);
      assert.equal(_require('../..').mocked, true);
    });

    it('should one lib with another', () => {
      mock('fs', () => 'path', true);
      assert.equal(_require('fs'), _require('path'));

      mock('../data/exported-fn.cjs', '../data/exported-obj.cjs');
      assert.equal(_require('../data/exported-fn.cjs'), _require('../data/exported-obj.cjs'));
    });

    it('should support re-requiring', () => {
      assert.equal(mock.reRequire('../data/index.cjs'), 'root');
    });

    it('should invoke a lazy factory once after success', () => {
      let calls = 0;
      mock(
        '../data/exported-obj.cjs',
        () => {
          calls += 1;
          return { mocked: true };
        },
        true
      );

      assert.strictEqual(calls, 0);
      const first = _require('../data/exported-obj.cjs');
      const second = _require('../data/exported-obj.cjs');

      assert.strictEqual(calls, 1);
      assert.strictEqual(second, first);
    });

    it('should retry a lazy factory after it throws', () => {
      let attempts = 0;
      mock(
        '../data/exported-obj.cjs',
        () => {
          attempts += 1;
          if (attempts === 1) throw new Error('first attempt');
          return { mocked: true };
        },
        true
      );

      assert.throws(() => _require('../data/exported-obj.cjs'), /first attempt/);
      assert.strictEqual(_require('../data/exported-obj.cjs').mocked, true);
      assert.strictEqual(attempts, 2);
    });

    it('should resolve a lazy string replacement when required', () => {
      mock('../data/exported-fn.cjs', () => '../data/exported-obj.cjs', true);

      assert.strictEqual(_require('../data/exported-fn.cjs'), _require('../data/exported-obj.cjs'));
    });

    it('should cascade mocks', () => {
      mock('path', () => ({ mocked: true }), true);
      mock('fs', 'path');

      const fs = _require('fs');
      assert.equal(fs.mocked, true);
    });

    it('should never require the real lib when mocking it', () => {
      mock('../data/throw-exception.cjs', () => ({}), true);
      _require('../data/throw-exception.cjs');
    });

    it('should mock libs required elsewhere', () => {
      mock('../data/throw-exception.cjs', () => ({}), true);
      _require('../data/throw-exception-runner.cjs');
    });

    it('should only load the mocked lib when it is required', () => {
      mock('../data/throw-exception.cjs', () => '../data/throw-exception-when-required.cjs', true);
      try {
        _require('../data/throw-exception-runner.cjs');
        throw new Error('this line should never be executed.');
      } catch (error) {
        assert.equal((error as Error).message, 'this should run when required');
      }
    });

    it('should stop all mocks', () => {
      mock('fs', () => ({}), true);
      mock('path', () => ({}), true);
      const fsMock = _require('fs');
      const pathMock = _require('path');

      mock.stopAll();

      assert.notEqual(_require('fs'), fsMock);
      assert.notEqual(_require('path'), pathMock);
    });

    it('should mock a module that does not exist', () => {
      mock('a', () => ({ id: 'a' }), true);

      assert.equal(_require('a').id, 'a');
    });

    it('should mock multiple modules that do not exist', () => {
      mock('a', () => ({ id: 'a' }), true);
      mock('b', () => ({ id: 'b' }), true);
      mock('c', () => ({ id: 'c' }), true);

      assert.equal(_require('a').id, 'a');
      assert.equal(_require('b').id, 'b');
      assert.equal(_require('c').id, 'c');
    });

    it('should mock a local file that does not exist', () => {
      mock('../data/a.cjs', () => ({ id: 'a' }), true);
      assert.equal(_require('../data/a.cjs').id, 'a');

      mock('../a.cjs', () => ({ id: 'a' }), true);
      assert.equal(_require('../a.cjs').id, 'a');
    });

    it('should mock a local file required elsewhere', () => {
      mock('../data/x.cjs', () => ({ id: 'x' }), true);
      assert.equal(_require('../data/nested/module-c.cjs').dependentOn.id, 'x');
    });

    it('should mock multiple local files that do not exist', () => {
      mock('../data/a.cjs', () => ({ id: 'a' }), true);
      mock('../data/b.cjs', () => ({ id: 'b' }), true);
      mock('../data/c.cjs', () => ({ id: 'c' }), true);

      assert.equal(_require('../data/a.cjs').id, 'a');
      assert.equal(_require('../data/b.cjs').id, 'b');
      assert.equal(_require('../data/c.cjs').id, 'c');
    });

    it('should unmock a module that is not found', () => {
      const moduleName = 'module-that-is-not-installed';

      mock(moduleName, () => ({ mocked: true }), true);
      mock.stop(moduleName);

      try {
        _require(moduleName);
        throw new Error('this line should never be executed.');
      } catch (e) {
        assert.equal((e as NodeJS.ErrnoException).code, 'MODULE_NOT_FOUND');
      }
    });

    it('should differentiate between local files and external modules with the same name', () => {
      mock('module-a', () => ({ id: 'external-module-a' }), true);

      const b = _require('../data/module-b.cjs');

      assert.equal(b.dependentOn.id, 'local-module-a');
      assert.equal(b.dependentOn.dependentOn.id, 'external-module-a');
    });

    it('should return a lazy primitive mock value', () => {
      mock('lazy-primitive', () => 0, true);

      assert.strictEqual(_require('lazy-primitive'), 0);
    });
  });
});
