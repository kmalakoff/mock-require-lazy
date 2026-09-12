import read, { value } from './dep.mjs';
export { identity } from './singleton.mjs';
export const output = [read(), value];
