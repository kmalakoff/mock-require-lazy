const Module = require('module');
const dirname = require('path').dirname;
const join = require('path').join;
const resolve = require('path').resolve;
const pathsep = require('path').sep;
const getCallerFile = require('get-caller-file');
const normalize = require('normalize-path');
const originalLoader = Module._load;

let mockExports = {};
let pendingMockExports = {};
const hasOwnPropertyCached = {}.hasOwnProperty;

Module._load = function (request, parent) {
  // biome-ignore lint/style/noArguments: <explanation>
  if (!parent) return originalLoader.apply(this, arguments);

  const fullFilePath = getFullPathNormalized(request, parent.filename);

  if (hasOwnPropertyCached.call(pendingMockExports, fullFilePath)) {
    const pending = pendingMockExports[fullFilePath];
    const mockExport = pending.lazy ? pending.mockExport() : pending.mockExport;

    mockExports[fullFilePath] = typeof mockExport === 'string' ? require(getFullPathNormalized(mockExport, pending.calledFrom)) : mockExport;

    delete pendingMockExports[fullFilePath];
  }

  // biome-ignore lint/style/noArguments: <explanation>
  return hasOwnPropertyCached.call(mockExports, fullFilePath) ? mockExports[fullFilePath] : originalLoader.apply(this, arguments);
};

function startMocking(path, mockExport, lazy) {
  const calledFrom = getCallerFile();

  pendingMockExports[getFullPathNormalized(path, calledFrom)] = {
    mockExport: mockExport,
    calledFrom: calledFrom,
    lazy: lazy,
  };
}

function stopMocking(path) {
  const calledFrom = getCallerFile();
  const fullPath = getFullPathNormalized(path, calledFrom);
  delete pendingMockExports[fullPath];
  delete mockExports[fullPath];
}

function stopMockingAll() {
  mockExports = {};
  pendingMockExports = {};
}

function reRequire(path) {
  const module = getFullPathNormalized(path, getCallerFile());
  delete require.cache[require.resolve(module)];
  return require(module);
}

function isInNodePath(resolvedPath) {
  if (!resolvedPath) return false;

  return Module.globalPaths.map((nodePath) => resolve(process.cwd(), nodePath) + pathsep).some((fullNodePath) => resolvedPath.indexOf(fullNodePath) === 0);
}

function getFullPath(path, calledFrom) {
  let resolvedPath;
  try {
    resolvedPath = require.resolve(path);
  } catch (_e) {
    // do nothing
  }

  const isLocalModule = /^\.{1,2}[/\\]?/.test(path);
  const isInPath = isInNodePath(resolvedPath);
  const isExternal = !isLocalModule && /[/\\]node_modules[/\\]/.test(resolvedPath);
  const isSystemModule = resolvedPath === path;

  if (isExternal || isSystemModule || isInPath) {
    return resolvedPath;
  }

  if (!isLocalModule) {
    return path;
  }

  const localModuleName = join(dirname(calledFrom), path);
  try {
    return Module._resolveFilename(localModuleName);
  } catch (e) {
    if (isModuleNotFoundError(e)) {
      return localModuleName;
    }
    throw e;
  }
}

function getFullPathNormalized(path, calledFrom) {
  return normalize(getFullPath(path, calledFrom));
}

function isModuleNotFoundError(e) {
  return e.code && e.code === 'MODULE_NOT_FOUND';
}

module.exports = startMocking;
module.exports.stop = stopMocking;
module.exports.stopAll = stopMockingAll;
module.exports.reRequire = reRequire;
