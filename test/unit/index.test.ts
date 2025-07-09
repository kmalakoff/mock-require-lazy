import assert from 'assert';
// @ts-ignore
import mock from 'mock-require-lazy';
import Module from 'module';
import normalize from 'normalize-path';

const _require = typeof require === 'undefined' ? Module.createRequire(import.meta.url) : require;

describe('Mock Require', function () {
  afterEach(function () {
    mock.stopAll();
  });

  describe('immediate', function () {
    it('should mock a required function', function () {
      mock('../data/exported-fn.cjs', function () {
        return 'mocked fn';
      });

      assert.equal(_require('../data/exported-fn.cjs')(), 'mocked fn');
    });

    it('should mock a required object', function () {
      mock('../data/exported-obj.cjs', {
        mocked: true,
        fn: function () {
          return 'mocked obj';
        },
      });

      var obj = _require('../data/exported-obj.cjs');
      assert.equal(obj.fn(), 'mocked obj');
      assert.equal(obj.mocked, true);

      mock.stop('../data/exported-obj.cjs');

      obj = _require('../data/exported-obj.cjs');
      assert.equal(obj.fn(), 'exported object');
      assert.equal(obj.mocked, false);
    });

    it('should unmock', function () {
      mock('../data/exported-fn.cjs', function () {
        return 'mocked fn';
      });

      mock.stop('../data/exported-fn.cjs');

      var fn = _require('../data/exported-fn.cjs');
      assert.equal(fn(), 'exported function');
    });

    it('should mock a root file', function () {
      mock('../..', { mocked: true });
      assert.equal(_require('../..').mocked, true);
    });

    it('should mock a standard lib', function () {
      mock('fs', { mocked: true });

      var fs = _require('fs');
      assert.equal(fs.mocked, true);
    });

    it('should mock an external lib', function () {
      mock('mocha', { mocked: true });

      var mocha = _require('mocha');
      assert.equal(mocha.mocked, true);
    });

    it('should one lib with another', function () {
      mock('fs', 'path');
      assert.equal(_require('fs'), _require('path'));

      mock('../data/exported-fn.cjs', '../data/exported-obj.cjs');
      assert.equal(_require('../data/exported-fn.cjs'), _require('../data/exported-obj.cjs'));
    });

    it('should support re-requiring', function () {
      assert.equal(mock.reRequire('../data/index.cjs'), 'root');
    });

    it('should cascade mocks', function () {
      mock('path', { mocked: true });
      mock('fs', 'path');

      var fs = _require('fs');
      assert.equal(fs.mocked, true);
    });

    it('should never require the real lib when mocking it', function () {
      mock('../data/throw-exception.cjs', {});
      _require('../data/throw-exception.cjs');
    });

    it('should mock libs required elsewhere', function () {
      mock('../data/throw-exception.cjs', {});
      _require('../data/throw-exception-runner.cjs');
    });

    it('should only load the mocked lib when it is required', function () {
      mock('../data/throw-exception.cjs', '../data/throw-exception-when-required.cjs');
      try {
        _require('../data/throw-exception-runner.cjs');
        throw new Error('this line should never be executed.');
      } catch (error) {
        assert.equal(error.message, 'this should run when required');
      }
    });

    it('should stop all mocks', function () {
      mock('fs', {});
      mock('path', {});
      var fsMock = _require('fs');
      var pathMock = _require('path');

      mock.stopAll();

      assert.notEqual(_require('fs'), fsMock);
      assert.notEqual(_require('path'), pathMock);
    });

    it('should mock a module that does not exist', function () {
      mock('a', { id: 'a' });

      assert.equal(_require('a').id, 'a');
    });

    it('should mock multiple modules that do not exist', function () {
      mock('a', { id: 'a' });
      mock('b', { id: 'b' });
      mock('c', { id: 'c' });

      assert.equal(_require('a').id, 'a');
      assert.equal(_require('b').id, 'b');
      assert.equal(_require('c').id, 'c');
    });

    it('should mock a local file that does not exist', function () {
      mock('../data/a.cjs', { id: 'a' });
      assert.equal(_require('../data/a.cjs').id, 'a');

      mock('../a.cjs', { id: 'a' });
      assert.equal(_require('../a.cjs').id, 'a');
    });

    it('should mock a local file required elsewhere', function () {
      mock('../data/x.cjs', { id: 'x' });
      assert.equal(_require('../data/nested/module-c.cjs').dependentOn.id, 'x');
    });

    it('should mock multiple local files that do not exist', function () {
      mock('../data/a.cjs', { id: 'a' });
      mock('../data/b.cjs', { id: 'b' });
      mock('../data/c.cjs', { id: 'c' });

      assert.equal(_require('../data/a.cjs').id, 'a');
      assert.equal(_require('../data/b.cjs').id, 'b');
      assert.equal(_require('../data/c.cjs').id, 'c');
    });

    it('should unmock a module that is not found', function () {
      var moduleName = 'module-that-is-not-installed';

      mock(moduleName, { mocked: true });
      mock.stop(moduleName);

      try {
        _require(moduleName);
        throw new Error('this line should never be executed.');
      } catch (e) {
        assert.equal(e.code, 'MODULE_NOT_FOUND');
      }
    });

    it('should differentiate between local files and external modules with the same name', function () {
      mock('module-a', { id: 'external-module-a' });

      var b = _require('../data/module-b.cjs');

      assert.equal(b.dependentOn.id, 'local-module-a');
      assert.equal(b.dependentOn.dependentOn.id, 'external-module-a');
    });

    it.skip('should mock files in the node path by the full path', function () {
      assert.equal(normalize(process.env.NODE_PATH), 'test/data/node-path');

      mock('in-node-path', { id: 'in-node-path' });

      var b = _require('in-node-path');
      var c = _require('../data/node-path/in-node-path.cjs');

      assert.equal(b.id, 'in-node-path');
      assert.equal(c.id, 'in-node-path');

      assert.equal(b, c);
    });
  });

  describe('lazy', function () {
    it('should mock a required function', function () {
      mock(
        '../data/exported-fn.cjs',
        function () {
          return function () {
            return 'mocked fn';
          };
        },
        true
      );

      assert.equal(_require('../data/exported-fn.cjs')(), 'mocked fn');
    });

    it('should mock a standard lib', function () {
      mock(
        'fs',
        function () {
          return { mocked: true };
        },
        true
      );

      var fs = _require('fs');
      assert.equal(fs.mocked, true);
    });

    it('should mock a required object', function () {
      mock(
        '../data/exported-obj.cjs',
        function () {
          return {
            mocked: true,
            fn: function () {
              return 'mocked obj';
            },
          };
        },
        true
      );

      var obj = _require('../data/exported-obj.cjs');
      assert.equal(obj.fn(), 'mocked obj');
      assert.equal(obj.mocked, true);

      mock.stop('../data/exported-obj.cjs');

      obj = _require('../data/exported-obj.cjs');
      assert.equal(obj.fn(), 'exported object');
      assert.equal(obj.mocked, false);
    });

    it('should unmock', function () {
      mock(
        '../data/exported-fn.cjs',
        function () {
          return 'mocked fn';
        },
        true
      );

      mock.stop('../data/exported-fn.cjs');

      var fn = _require('../data/exported-fn.cjs');
      assert.equal(fn(), 'exported function');
    });

    it('should mock a root file', function () {
      mock(
        '../..',
        function () {
          return { mocked: true };
        },
        true
      );
      assert.equal(_require('../..').mocked, true);
    });

    it('should one lib with another', function () {
      mock(
        'fs',
        function () {
          return 'path';
        },
        true
      );
      assert.equal(_require('fs'), _require('path'));

      mock('../data/exported-fn.cjs', '../data/exported-obj.cjs');
      assert.equal(_require('../data/exported-fn.cjs'), _require('../data/exported-obj.cjs'));
    });

    it('should support re-requiring', function () {
      assert.equal(mock.reRequire('../data/index.cjs'), 'root');
    });

    it('should cascade mocks', function () {
      mock(
        'path',
        function () {
          return { mocked: true };
        },
        true
      );
      mock('fs', 'path');

      var fs = _require('fs');
      assert.equal(fs.mocked, true);
    });

    it('should never require the real lib when mocking it', function () {
      mock(
        '../data/throw-exception.cjs',
        function () {
          return {};
        },
        true
      );
      _require('../data/throw-exception.cjs');
    });

    it('should mock libs required elsewhere', function () {
      mock(
        '../data/throw-exception.cjs',
        function () {
          return {};
        },
        true
      );
      _require('../data/throw-exception-runner.cjs');
    });

    it('should only load the mocked lib when it is required', function () {
      mock(
        '../data/throw-exception.cjs',
        function () {
          return '../data/throw-exception-when-required.cjs';
        },
        true
      );
      try {
        _require('../data/throw-exception-runner.cjs');
        throw new Error('this line should never be executed.');
      } catch (error) {
        assert.equal(error.message, 'this should run when required');
      }
    });

    it('should stop all mocks', function () {
      mock(
        'fs',
        function () {
          return {};
        },
        true
      );
      mock(
        'path',
        function () {
          return {};
        },
        true
      );
      var fsMock = _require('fs');
      var pathMock = _require('path');

      mock.stopAll();

      assert.notEqual(_require('fs'), fsMock);
      assert.notEqual(_require('path'), pathMock);
    });

    it('should mock a module that does not exist', function () {
      mock(
        'a',
        function () {
          return { id: 'a' };
        },
        true
      );

      assert.equal(_require('a').id, 'a');
    });

    it('should mock multiple modules that do not exist', function () {
      mock(
        'a',
        function () {
          return { id: 'a' };
        },
        true
      );
      mock(
        'b',
        function () {
          return { id: 'b' };
        },
        true
      );
      mock(
        'c',
        function () {
          return { id: 'c' };
        },
        true
      );

      assert.equal(_require('a').id, 'a');
      assert.equal(_require('b').id, 'b');
      assert.equal(_require('c').id, 'c');
    });

    it('should mock a local file that does not exist', function () {
      mock(
        '../data/a.cjs',
        function () {
          return { id: 'a' };
        },
        true
      );
      assert.equal(_require('../data/a.cjs').id, 'a');

      mock(
        '../a.cjs',
        function () {
          return { id: 'a' };
        },
        true
      );
      assert.equal(_require('../a.cjs').id, 'a');
    });

    it('should mock a local file required elsewhere', function () {
      mock(
        '../data/x.cjs',
        function () {
          return { id: 'x' };
        },
        true
      );
      assert.equal(_require('../data/nested/module-c.cjs').dependentOn.id, 'x');
    });

    it('should mock multiple local files that do not exist', function () {
      mock(
        '../data/a.cjs',
        function () {
          return { id: 'a' };
        },
        true
      );
      mock(
        '../data/b.cjs',
        function () {
          return { id: 'b' };
        },
        true
      );
      mock(
        '../data/c.cjs',
        function () {
          return { id: 'c' };
        },
        true
      );

      assert.equal(_require('../data/a.cjs').id, 'a');
      assert.equal(_require('../data/b.cjs').id, 'b');
      assert.equal(_require('../data/c.cjs').id, 'c');
    });

    it('should unmock a module that is not found', function () {
      var moduleName = 'module-that-is-not-installed';

      mock(
        moduleName,
        function () {
          return { mocked: true };
        },
        true
      );
      mock.stop(moduleName);

      try {
        _require(moduleName);
        throw new Error('this line should never be executed.');
      } catch (e) {
        assert.equal(e.code, 'MODULE_NOT_FOUND');
      }
    });

    it('should differentiate between local files and external modules with the same name', function () {
      mock(
        'module-a',
        function () {
          return { id: 'external-module-a' };
        },
        true
      );

      var b = _require('../data/module-b.cjs');

      assert.equal(b.dependentOn.id, 'local-module-a');
      assert.equal(b.dependentOn.dependentOn.id, 'external-module-a');
    });

    it.skip('should mock files in the node path by the full path', function () {
      assert.equal(normalize(process.env.NODE_PATH), 'test/data/node-path');

      mock(
        'in-node-path',
        function () {
          return { id: 'in-node-path' };
        },
        true
      );

      var b = _require('in-node-path');
      var c = _require('../data/node-path/in-node-path.cjs');

      assert.equal(b.id, 'in-node-path');
      assert.equal(c.id, 'in-node-path');
    });
  });
});
