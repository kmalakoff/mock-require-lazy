import Module from 'module';
import type * as Core from './core.ts';

const _require = typeof require === 'undefined' ? Module.createRequire(import.meta.url) : require;
// Both package conditions delegate to the same CJS instance and registry.
const core: typeof Core = _require(typeof require === 'undefined' ? '../cjs/core.js' : './core.js');

export default core.default;
export const mockRequire = core.mockRequire;
export const mockImport = core.mockImport;
export const stop = core.stop;
export const stopAll = core.stopAll;
export const reRequire = core.reRequire;
export const reImport = core.reImport;
export type * from './types.ts';
