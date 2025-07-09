import getCallerFile from 'get-caller-file';
import _Module from 'module';
import normalize from 'normalize-path';
import { dirname, join, resolve, sep } from 'path';
import url from 'url';

interface ParentT {
  filename: string;
}
interface ModuleT {
  _load: (request: string, parent?: ParentT) => object;
  _resolveFilename: (name: string) => string;
  globalPaths: string[];
}

const Module = _Module as unknown as ModuleT;
const _require = typeof require === 'undefined' ? _Module.createRequire(import.meta.url) : require;

let mockExports = {};
let pendingMockExports = {};

// biome-ignore lint/suspicious/noShadowRestrictedNames: Legacy
const hasOwnProperty = {}.hasOwnProperty;
const startsWith = (string, check) => string.lastIndexOf(check, 0) === 0;

const originalLoader = Module._load;
Module._load = function (request: string, parent?: ParentT) {
  // biome-ignore lint/complexity/noArguments: Apply arguments
  if (!parent) return originalLoader.apply(this, arguments);

  const fullFilePath = getFullPathNormalized(request, parent.filename);

  if (hasOwnProperty.call(pendingMockExports, fullFilePath)) {
    const pending = pendingMockExports[fullFilePath];
    const mockExport = pending.lazy ? pending.mockExport() : pending.mockExport;

    mockExports[fullFilePath] = typeof mockExport === 'string' ? _require(getFullPathNormalized(mockExport, pending.calledFrom)) : mockExport;

    delete pendingMockExports[fullFilePath];
  }

  // biome-ignore lint/complexity/noArguments: Apply arguments
  return hasOwnProperty.call(mockExports, fullFilePath) ? mockExports[fullFilePath] : originalLoader.apply(this, arguments);
};

function stripFileProtocol(calledFrom) {
  return calledFrom.indexOf('file://', 0) === 0 ? url.fileURLToPath(calledFrom) : calledFrom;
}

export type MockExport = (() => unknown) | unknown;

export default function mock(path: string, mockExport: MockExport, lazy?: boolean): void {
  const calledFrom = stripFileProtocol(getCallerFile());

  pendingMockExports[getFullPathNormalized(path, calledFrom)] = {
    mockExport: mockExport,
    calledFrom: calledFrom,
    lazy: lazy,
  };
}

export const stop = function stopMocking(path: string): void {
  const calledFrom = stripFileProtocol(getCallerFile());
  const fullPath = getFullPathNormalized(path, calledFrom);
  delete pendingMockExports[fullPath];
  delete mockExports[fullPath];
};

export const stopAll = function stopMockingAll(): void {
  mockExports = {};
  pendingMockExports = {};
};

export const reRequire = function reRequire(path: string): unknown {
  const module = getFullPathNormalized(path, stripFileProtocol(getCallerFile()));
  delete _require.cache[_require.resolve(module)];
  return _require(module);
};
mock.stop = stop;
mock.stopAll = stopAll;
mock.reRequire = reRequire;

function isInNodePath(resolvedPath) {
  if (!resolvedPath) return false;

  return Module.globalPaths.map((nodePath) => resolve(process.cwd(), nodePath) + sep).some((fullNodePath) => startsWith(resolvedPath, fullNodePath));
}

function getFullPath(path, calledFrom) {
  let resolvedPath: string | null;
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

function getFullPathNormalized(path: string, calledFrom: string) {
  return normalize(getFullPath(path, calledFrom));
}

function isModuleNotFoundError(e) {
  return e.code && e.code === 'MODULE_NOT_FOUND';
}
