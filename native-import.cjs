'use strict';

// Loaded only after the ESM runtime check, keeping native import out of the CJS transpiler.
module.exports = function () {
  return import('./loader.mjs');
};
