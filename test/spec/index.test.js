var assert = require('assert');
var normalize = require('normalize-path');
var mock = require('../..');

describe('Mock Require', function () {
  afterEach(function () {
    mock.stopAll();
  });

  describe('immediate', function () {
    it('should mock a required function', function () {
      mock('../data/exported-fn', function () {
        return 'mocked fn';
      });

      assert.equal(require('../data/exported-fn')(), 'mocked fn');
    });

    it('should mock a required object', function () {
      mock('../data/exported-obj', {
        mocked: true,
        fn: function () {
          return 'mocked obj';
        },
      });

      var obj = require('../data/exported-obj');
      assert.equal(obj.fn(), 'mocked obj');
      assert.equal(obj.mocked, true);

      mock.stop('../data/exported-obj');

      obj = require('../data/exported-obj');
      assert.equal(obj.fn(), 'exported object');
      assert.equal(obj.mocked, false);
    });

    it('should unmock', function () {
      mock('../data/exported-fn', function () {
        return 'mocked fn';
      });

      mock.stop('../data/exported-fn');

      var fn = require('../data/exported-fn');
      assert.equal(fn(), 'exported function');
    });

    it('should mock a root file', function () {
      mock('../..', { mocked: true });
      assert.equal(require('../..').mocked, true);
    });

    it('should mock a standard lib', function () {
      mock('fs', { mocked: true });

      var fs = require('fs');
      assert.equal(fs.mocked, true);
    });

    it('should mock an external lib', function () {
      mock('mocha', { mocked: true });

      var mocha = require('mocha');
      assert.equal(mocha.mocked, true);
    });

    it('should one lib with another', function () {
      mock('fs', 'path');
      assert.equal(require('fs'), require('path'));

      mock('../data/exported-fn', '../data/exported-obj');
      assert.equal(require('../data/exported-fn'), require('../data/exported-obj'));
    });

    it('should support re-requiring', function () {
      assert.equal(mock.reRequire('../data'), 'root');
    });

    it('should cascade mocks', function () {
      mock('path', { mocked: true });
      mock('fs', 'path');

      var fs = require('fs');
      assert.equal(fs.mocked, true);
    });

    it('should never require the real lib when mocking it', function () {
      mock('../data/throw-exception', {});
      require('../data/throw-exception');
    });

    it('should mock libs required elsewhere', function () {
      mock('../data/throw-exception', {});
      require('../data/throw-exception-runner');
    });

    it('should only load the mocked lib when it is required', function () {
      mock('../data/throw-exception', '../data/throw-exception-when-required');
      try {
        require('../data/throw-exception-runner');
        throw new Error('this line should never be executed.');
      } catch (error) {
        assert.equal(error.message, 'this should run when required');
      }
    });

    it('should stop all mocks', function () {
      mock('fs', {});
      mock('path', {});
      var fsMock = require('fs');
      var pathMock = require('path');

      mock.stopAll();

      assert.notEqual(require('fs'), fsMock);
      assert.notEqual(require('path'), pathMock);
    });

    it('should mock a module that does not exist', function () {
      mock('a', { id: 'a' });

      assert.equal(require('a').id, 'a');
    });

    it('should mock multiple modules that do not exist', function () {
      mock('a', { id: 'a' });
      mock('b', { id: 'b' });
      mock('c', { id: 'c' });

      assert.equal(require('a').id, 'a');
      assert.equal(require('b').id, 'b');
      assert.equal(require('c').id, 'c');
    });

    it('should mock a local file that does not exist', function () {
      mock('../data/a', { id: 'a' });
      assert.equal(require('../data/a').id, 'a');

      mock('../a', { id: 'a' });
      assert.equal(require('../a').id, 'a');
    });

    it('should mock a local file required elsewhere', function () {
      mock('../data/x', { id: 'x' });
      assert.equal(require('../data/nested/module-c').dependentOn.id, 'x');
    });

    it('should mock multiple local files that do not exist', function () {
      mock('../data/a', { id: 'a' });
      mock('../data/b', { id: 'b' });
      mock('../data/c', { id: 'c' });

      assert.equal(require('../data/a').id, 'a');
      assert.equal(require('../data/b').id, 'b');
      assert.equal(require('../data/c').id, 'c');
    });

    it('should unmock a module that is not found', function () {
      var moduleName = 'module-that-is-not-installed';

      mock(moduleName, { mocked: true });
      mock.stop(moduleName);

      try {
        require(moduleName);
        throw new Error('this line should never be executed.');
      } catch (e) {
        assert.equal(e.code, 'MODULE_NOT_FOUND');
      }
    });

    it('should differentiate between local files and external modules with the same name', function () {
      mock('module-a', { id: 'external-module-a' });

      var b = require('../data/module-b');

      assert.equal(b.dependentOn.id, 'local-module-a');
      assert.equal(b.dependentOn.dependentOn.id, 'external-module-a');
    });

    it('should mock files in the node path by the full path', function () {
      assert.equal(normalize(process.env.NODE_PATH), 'test/data/node-path');

      mock('in-node-path', { id: 'in-node-path' });

      var b = require('in-node-path');
      var c = require('../data/node-path/in-node-path');

      assert.equal(b.id, 'in-node-path');
      assert.equal(c.id, 'in-node-path');

      assert.equal(b, c);
    });
  });

  describe('lazy', function () {
    it('should mock a required function', function () {
      mock(
        '../data/exported-fn',
        function () {
          return function () {
            return 'mocked fn';
          };
        },
        true
      );

      assert.equal(require('../data/exported-fn')(), 'mocked fn');
    });

    it('should mock a standard lib', function () {
      mock(
        'fs',
        function () {
          return { mocked: true };
        },
        true
      );

      var fs = require('fs');
      assert.equal(fs.mocked, true);
    });

    it('should mock a required object', function () {
      mock(
        '../data/exported-obj',
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

      var obj = require('../data/exported-obj');
      assert.equal(obj.fn(), 'mocked obj');
      assert.equal(obj.mocked, true);

      mock.stop('../data/exported-obj');

      obj = require('../data/exported-obj');
      assert.equal(obj.fn(), 'exported object');
      assert.equal(obj.mocked, false);
    });

    it('should unmock', function () {
      mock('../data/exported-fn', function () {
        return (
          function () {
            return 'mocked fn';
          },
          true
        );
      });

      mock.stop('../data/exported-fn');

      var fn = require('../data/exported-fn');
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
      assert.equal(require('../..').mocked, true);
    });

    it('should one lib with another', function () {
      mock(
        'fs',
        function () {
          return 'path';
        },
        true
      );
      assert.equal(require('fs'), require('path'));

      mock('../data/exported-fn', '../data/exported-obj');
      assert.equal(require('../data/exported-fn'), require('../data/exported-obj'));
    });

    it('should support re-requiring', function () {
      assert.equal(mock.reRequire('../data'), 'root');
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

      var fs = require('fs');
      assert.equal(fs.mocked, true);
    });

    it('should never require the real lib when mocking it', function () {
      mock(
        '../data/throw-exception',
        function () {
          return {};
        },
        true
      );
      require('../data/throw-exception');
    });

    it('should mock libs required elsewhere', function () {
      mock(
        '../data/throw-exception',
        function () {
          return {};
        },
        true
      );
      require('../data/throw-exception-runner');
    });

    it('should only load the mocked lib when it is required', function () {
      mock(
        '../data/throw-exception',
        function () {
          return '../data/throw-exception-when-required';
        },
        true
      );
      try {
        require('../data/throw-exception-runner');
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
      var fsMock = require('fs');
      var pathMock = require('path');

      mock.stopAll();

      assert.notEqual(require('fs'), fsMock);
      assert.notEqual(require('path'), pathMock);
    });

    it('should mock a module that does not exist', function () {
      mock(
        'a',
        function () {
          return { id: 'a' };
        },
        true
      );

      assert.equal(require('a').id, 'a');
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

      assert.equal(require('a').id, 'a');
      assert.equal(require('b').id, 'b');
      assert.equal(require('c').id, 'c');
    });

    it('should mock a local file that does not exist', function () {
      mock(
        '../data/a',
        function () {
          return { id: 'a' };
        },
        true
      );
      assert.equal(require('../data/a').id, 'a');

      mock(
        '../a',
        function () {
          return { id: 'a' };
        },
        true
      );
      assert.equal(require('../a').id, 'a');
    });

    it('should mock a local file required elsewhere', function () {
      mock(
        '../data/x',
        function () {
          return { id: 'x' };
        },
        true
      );
      assert.equal(require('../data/nested/module-c').dependentOn.id, 'x');
    });

    it('should mock multiple local files that do not exist', function () {
      mock(
        '../data/a',
        function () {
          return { id: 'a' };
        },
        true
      );
      mock(
        '../data/b',
        function () {
          return { id: 'b' };
        },
        true
      );
      mock(
        '../data/c',
        function () {
          return { id: 'c' };
        },
        true
      );

      assert.equal(require('../data/a').id, 'a');
      assert.equal(require('../data/b').id, 'b');
      assert.equal(require('../data/c').id, 'c');
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
        require(moduleName);
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

      var b = require('../data/module-b');

      assert.equal(b.dependentOn.id, 'local-module-a');
      assert.equal(b.dependentOn.dependentOn.id, 'external-module-a');
    });

    it('should mock files in the node path by the full path', function () {
      assert.equal(normalize(process.env.NODE_PATH), 'test/data/node-path');

      mock(
        'in-node-path',
        function () {
          return { id: 'in-node-path' };
        },
        true
      );

      var b = require('in-node-path');
      var c = require('../data/node-path/in-node-path');

      assert.equal(b.id, 'in-node-path');
      assert.equal(c.id, 'in-node-path');

      assert.equal(b, c);
    });
  });
});
