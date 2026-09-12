# mock-require-lazy

Replace dependencies loaded through `require()` or native ESM imports, with immediate values or lazy factories.

## About

This is a fork of mock-require that adds lazy loading and keeps its CommonJS API. The import and require package entries share one registry and cleanup API.

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

`mock.require(path, replacement, { lazy: true })` is the explicit require form; the existing `mock(path, factory, true)` remains valid. A function without lazy mode is a replacement value, not a factory.

## Native ESM

Register mocks before importing the subject. Static imports inside a subsequently loaded subject are intercepted; an already evaluated module's bindings do not change.

```javascript
import mock from 'mock-require-lazy';

async function test() {
  await mock.import('fs', () => ({ readFileSync: () => 'mocked' }), {
    lazy: true,
    exports: ['readFileSync'],
  });
  try {
    const fs = await import('fs');
    console.log(fs.readFileSync()); // mocked
  } finally {
    mock.stopAll();
  }
}
test();
```

`mock.import(path, namespace)` accepts an object containing named exports and, when needed, a `default` property. Use `{ default: fn }` for a function-valued default. Lazy factories require `{ lazy: true, exports: ['default', 'name'] }` so Node can link export names without running the factory. Factories are synchronous; promise-valued exports inside the returned object are allowed.

`await mock.import('./dependency.mjs', './replacement.mjs')` redirects to another module and preserves its actual namespace. Both paths resolve from the registration caller. The named exports `mockImport`, `mockRequire`, `reImport`, `reRequire`, `stop`, and `stopAll` expose the same functions as the attached methods.

### Runtime and loader setup

CommonJS mocking retains Node 0.8 support, including `createRequire()` calls made from ESM on newer Node. Native import mocking requires Node 12.22 or newer and Node's loader hooks.

- Node 12/14/16 and Node 18 before 18.19 need startup registration: `node --loader=mock-require-lazy/loader test.mjs`.
- Node 20 before 20.6 also needs startup registration.
- Node 18.19+, 20.6+, and newer releases register hooks when the import API is first used.
- Native `require(esm)` only participates in import mocking when synchronous hooks are available and reliable: Node 22.22.3+ and later applicable branches. On async-hook runtimes, use native `import()` for ESM subjects. Ordinary CommonJS require mocking is unaffected. Node still rejects synchronously requiring a top-level-await graph.

Older startup loaders emit Node's experimental warning. Mocks are process-global, not isolated between parallel tests; use separate processes or workers with their own setup for independent mock state.

### Extensions and TypeScript

The library follows the active resolver. CommonJS keeps its implicit-extension lookup. Native ESM requires explicit relative extensions unless the installed loader supplies a different policy. Alternate requests match when the resolver identifies the same module. Distinct `.ts` and `.js` files are not automatically aliases; ESM queries and fragments retain their identities. Bare packages resolve from the caller using the operation's import or require conditions.

Compatibility change: bare CommonJS registrations now resolve from the registration caller, rather than this library's directory. Separate copies of the same package no longer accidentally share a mock. Register each resolved copy when both should be replaced. The callable API and boolean lazy argument remain supported.

The library does not transpile TypeScript. Install a loader such as `ts-swc-loaders`, or compile first. `.cts` forces CommonJS and `.mts` forces ESM; `.ts` follows the package and loader configuration. Tests exercise typed subjects and real dependencies, not merely mocks registered against typed filenames.

With ts-swc-loaders 2.9.0, load imported CommonJS TypeScript subjects through `await mock.reImport('./subject.cts')` after registering `require('ts-swc-loaders')`, or precompile them. This uses the CJS transform before creating the imported namespace. A plain native `.cts` import can bypass that transform on newer Node. Native type stripping also does not turn `import` statements into `require`.

The tested composite loader supports native TypeScript on Node 12.22, 14, and Node 16.12 onward. On Node 16.0–16.11, ts-swc-loaders lacks the legacy ESM hook; compile ESM TypeScript first. CommonJS TypeScript still works there.

For CommonJS TypeScript, register the CJS loader before loading subjects: `require('ts-swc-loaders')`. For native ESM on chaining-capable Node, launch with `ts-swc node test.mjs` and use the import API. Before native loader chaining, use a composite loader or precompile; the [tested composite example](test/data/typed/loader.mjs) shows how the hooks compose. The fixture's tsconfig defines which source files are transpiled.

### Refresh and cleanup

`await mock.reImport('./subject.mjs')` refreshes only that subject. Cached dependencies retain their identity unless explicitly refreshed or replaced. For a chain A → B → C, changing C and refreshing A does not rebuild cached B; refresh B, then A, if both need updating. Imported CJS subjects also have their own CJS cache entry cleared.

Successful lazy values are reused for their registration. If a factory throws, the error propagates and a later fresh load can retry. Re-registering starts a new lazy lifecycle.

`stop(path)` and `stopAll()` synchronously remove registrations for future loads and cancel pending registrations. Loads that already selected a mock finish with that registration. Cleanup does not mutate existing module objects or namespaces. ESM refresh creates new Node module instances; Node does not provide a general ESM-cache purge, so repeated refreshes consume memory for the process lifetime.

Wrappers can supply `{ parentURL: import.meta.url }` or an absolute caller filename to `mock.import()` and `reImport()`. Without that option, resolution uses the public call's caller. Stop a registration from its registration location or by its resolved file URL.

Missing bare names use one global virtual identity, as in the legacy require API. Existing package copies remain distinct when they resolve to different files. Export names must be JavaScript identifiers, including `default`; string-named exports such as `'a-b'` are not supported across the old ESM runtimes.

`NODE_PATH` is not required. Node's legacy CommonJS search path remains supported through normal resolved-file matching; it is not added to ESM resolution.

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
npm run test:engines
npm run test:esm:boundaries
```
