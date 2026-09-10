# mock-require-lazy

Replace modules loaded through `require()`, either immediately or when the module is first requested.

## About

This is a fork of mock-require that adds lazy loading and keeps its API.

## Installation

```sh
npm install mock-require-lazy
```

## Usage

```javascript
var mock = require("mock-require-lazy");

mock("http", {
  request: function () {
    console.log("http.request called");
  },
});

var http = require("http");
http.request(); // 'http.request called'

// lazy
mock("path", function () {
  return {
    join: function () {
      console.log("path.join called");
    }
  };
}, true);

var path = require("path");
path.join(); // 'path.join called'
```

The examples use `require()`. This package intercepts CommonJS module loading; static ESM imports are not intercepted.

## API

### `mock(path, mockExport, lazy?)`

**path**: `String`

The module that you want to mock. This is the same string you would pass in if you wanted to `require` the module.

This path should be relative to the current file, just as it would be if you were to `require` the module from the current file. mock-require-lazy also matches this module when another file requires it using a different relative path.

**mockExport** : `object/function`

The function or object you want to be returned from `require`, instead of the `path` module's exports.

**mockExport** : `string`

The module you want to be returned from `require`, instead of the `path` module's export. This allows you to replace modules with other modules. For example, if you wanted to replace the `fs` module with the `path` module (you probably wouldn't, but if you did):

**lazy** : `boolean`

When true, `mockExport` must be a factory. The factory runs when the mocked module is first required.

```javascript
mock('fs', 'path');
require('fs') === require('path'); // true
```

This is useful if you have a mock library that you want to use in multiple places. For example:

`test/spy.js`:

```javascript
module.exports = function () {
  return 'this was mocked';
};
```

`test/a_spec.js`:

```javascript
var mock = require('mock-require-lazy');
mock('../some/dependency', './spy');
...
```

`test/b_spec.js`:

```javascript
var mock = require('mock-require-lazy');
mock('../some/other/dependency', './spy');
...
```

### `mock.stop(path)`

**path**: `String`

The module you that you want to stop mocking. This is the same string you would pass in if you wanted to `require` the module.

This will only modify variables used after `mock.stop` is called. For example:

```javascript
var mock = require('mock-require-lazy');
mock('fs', { mockedFS: true });

var fs1 = require('fs');

mock.stop('fs');

var fs2 = require('fs');

fs1 === fs2; // false
```

### `mock.stopAll()`

This function can be used to remove all registered mocks without the need to remove them individually using `mock.stop()`.

```javascript
mock('fs', {});
mock('path', {});

var fs1 = require('fs');
var path1 = require('path');

mock.stopAll();

var fs2 = require('fs');
var path2 = require('path');

fs1 === fs2; // false
path1 === path2; // false
```

### `mock.reRequire(path)`

**path**: `String`

The file whose cache you want to refresh. This is useful if you're trying to mock a dependency for a file that has already been required elsewhere (possibly in another test file). Normally, Node.js will cache this file, so any mocks that you apply afterwards will have no effect. `reRequire` clears the cache and allows your mock to work.

```javascript
var fs = require('fs');
var fileToTest = require('./fileToTest');
mock('fs', {}); // fileToTest is still using the unmocked fs module

fileToTest = mock.reRequire('./fileToTest'); // fileToTest is now using your mock
```

Note that if the file you are testing requires dependencies that in turn require the mock, those dependencies will still have the unmocked version. You may want to `reRequire` all of your dependencies to ensure that your mock is always being used.

```javascript
var fs = require('fs');
var otherDep = require('./otherDep'); // requires fs as a dependency
var fileToTest = require('./fileToTest'); // requires fs and otherDep as a dependency
mock('fs', {}); // fileToTest and otherDep are still using the unmocked fs module

otherDep = mock.reRequire('./otherDep'); // do this to make sure fs is being mocked consistently
fileToTest = mock.reRequire('./fileToTest');
```

## Test

```
npm test
```
