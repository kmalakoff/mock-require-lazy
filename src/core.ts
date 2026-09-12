import getCallerFile from 'get-caller-file';
import _Module from 'module';
import normalize from 'normalize-path';
import { dirname, resolve } from 'path';
import url from 'url';
import type * as ImportState from './lib/esm-state.ts';
import type { ImportOptions, MockExport, RequireOptions } from './types.ts';

interface ParentT {
  filename: string;
  paths?: string[];
}
interface ModuleT {
  _load: (request: string, parent?: ParentT, ...args: unknown[]) => unknown;
  _resolveFilename: (name: string, parent?: ParentT) => string;
  _nodeModulePaths: (directory: string) => string[];
}

export type { MockExport } from './types.ts';

interface PendingMockExport {
  mockExport: MockExport;
  calledFrom: string;
  lazy?: boolean;
}

const Module = _Module as unknown as ModuleT;
const _require = typeof require === 'undefined' ? _Module.createRequire(import.meta.url) : require;

let mockExports: Record<string, unknown> = Object.create(null);
let pendingMockExports: Record<string, PendingMockExport> = Object.create(null);

const owns = Object.prototype.hasOwnProperty;
let imports: typeof ImportState | undefined;

const originalLoader = Module._load;
Module._load = function (request: string, parent?: ParentT, ...args: unknown[]) {
  if (!parent) return originalLoader.apply(this, [request, parent, ...args]);

  const fullFilePath = mockKey(request, parent.filename, parent);

  if (owns.call(pendingMockExports, fullFilePath)) {
    const pending = pendingMockExports[fullFilePath];
    const mockExport = pending.lazy ? (pending.mockExport as () => unknown)() : pending.mockExport;

    mockExports[fullFilePath] = typeof mockExport === 'string' ? _require(getFullPathNormalized(mockExport, pending.calledFrom)) : mockExport;

    delete pendingMockExports[fullFilePath];
  }

  return owns.call(mockExports, fullFilePath) ? mockExports[fullFilePath] : originalLoader.apply(this, [request, parent, ...args]);
};

function stripFileProtocol(calledFrom: string) {
  return calledFrom.indexOf('file://', 0) === 0 ? url.fileURLToPath(calledFrom) : calledFrom;
}
export default function mock(path: string, mockExport: MockExport, options?: boolean | RequireOptions): void {
  const calledFrom = stripFileProtocol(getCallerFile());

  pendingMockExports[mockKey(path, calledFrom)] = {
    mockExport: mockExport,
    calledFrom: calledFrom,
    lazy: options && typeof options === 'object' ? options.lazy : !!options,
  };
}

export const stop = function stopMocking(path: string): void {
  const calledFrom = stripFileProtocol(getCallerFile());
  const stoppedImport = imports && imports.stop(path, calledFrom);
  let fullPath: string;
  try {
    fullPath = mockKey(path, calledFrom);
  } catch (error) {
    // An import-only export need not be resolvable under the require condition during cleanup.
    if (stoppedImport && (error as NodeJS.ErrnoException).code === 'ERR_PACKAGE_PATH_NOT_EXPORTED') return;
    throw error;
  }
  delete pendingMockExports[fullPath];
  delete mockExports[fullPath];
};

export const stopAll = function stopMockingAll(): void {
  mockExports = Object.create(null);
  pendingMockExports = Object.create(null);
  if (imports) imports.stopAll();
};

export const reRequire = function reRequire(path: string): unknown {
  const module = getFullPathNormalized(path, stripFileProtocol(getCallerFile()));
  delete _require.cache[_require.resolve(module)];
  return _require(module);
};
mock.stop = stop;
mock.stopAll = stopAll;
mock.reRequire = reRequire;
mock.require = mock;
mock.import = mockImport;
mock.reImport = reImport;
export const mockRequire = mock;

function importRuntime() {
  const versions = process.versions.node.split('.').map(Number);
  if (versions[0] < 12 || (versions[0] === 12 && versions[1] < 22)) throw new Error('Import mocking requires Node 12.22 or newer; require mocking remains available.');
  // The modern state and native-import bridge must never load on the legacy require path.
  if (!imports) imports = _require('./lib/esm-state.js');
  return imports as typeof ImportState;
}

export function mockImport(path: string, replacement: MockExport, options?: ImportOptions): Promise<void> {
  const calledFrom = getCallerFile();
  const state = importRuntime();
  const parentURL = state.parentURL(options?.parentURL || calledFrom);
  const ticket = state.begin(path, parentURL);
  return Promise.resolve()
    .then(() => _require('../../native-import.cjs')())
    .then((runtime: { register: (path: string, value: unknown, options: ImportOptions, parent: string, ticket: ImportState.Ticket) => Promise<void> }) => runtime.register(path, replacement, options || {}, parentURL, ticket))
    .then(
      () => state.finish(ticket),
      (error: Error) => {
        state.finish(ticket);
        throw error;
      }
    );
}

export function reImport(path: string, options?: { parentURL?: string }): Promise<Record<string, unknown>> {
  const calledFrom = getCallerFile();
  const state = importRuntime();
  const parentURL = state.parentURL(options?.parentURL || calledFrom);
  return _require('../../native-import.cjs')().then((runtime: { refresh: (path: string, parent: string) => Promise<Record<string, unknown>> }) => runtime.refresh(path, parentURL));
}

function getFullPath(path: string, calledFrom: string, parent?: ParentT) {
  const local = /^\.{1,2}([/\\]|$)/.test(path);
  const request = local ? resolve(dirname(calledFrom), path) : path;
  const caller = parent || { filename: calledFrom, paths: Module._nodeModulePaths(dirname(calledFrom)) };
  try {
    return Module._resolveFilename(request, caller);
  } catch (e) {
    if (isModuleNotFoundError(e as NodeJS.ErrnoException)) {
      return request;
    }
    throw e;
  }
}

function getFullPathNormalized(path: string, calledFrom: string, parent?: ParentT) {
  const fullPath = getFullPath(path, calledFrom, parent);
  const unprefixed = fullPath.indexOf('node:') === 0 ? fullPath.slice(5) : fullPath;
  return normalize((_Module.builtinModules || []).indexOf(unprefixed) >= 0 ? unprefixed : fullPath);
}

function mockKey(path: string, calledFrom: string, parent?: ParentT) {
  // Old V8 treats __proto__ specially even on null-prototype objects.
  return `$${getFullPathNormalized(path, calledFrom, parent)}`;
}

function isModuleNotFoundError(e: NodeJS.ErrnoException) {
  return e.code && e.code === 'MODULE_NOT_FOUND';
}
