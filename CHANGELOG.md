# Changelog

## [3.0.0] - 2026-09-12

### Added

- Native ESM mocking through `mock.import()`, `mock.reImport()`, and the `mock-require-lazy/loader` entry point. Immediate namespaces, synchronous lazy factories, module redirects, builtins, conditional exports, and shallow module refresh are supported.
- `mock(path, replacement, { mode: 'both' })` registers one replacement for both CommonJS `require()` and native ESM `import()`. The call is asynchronous and returns `Promise<void>`. `replacement` is a namespace object, a module redirect string, or, with `lazy: true`, a synchronous factory returning a namespace (`exports` is then required, as for `mock.import`). A lazy factory evaluates once, shared across whichever loader reaches it first, and retries on the next load after a throw. A callable replacement is rejected; use `mock.require` and `mock.import` separately for that.
- Require registration, import registration, cleanup, and both refresh methods accept `{ parentURL }`, so a wrapper can resolve every operation on behalf of another module.
- The package now exposes matching default and named APIs from CommonJS and ESM package entries. TypeScript `.ts`, `.cts`, and `.mts` subjects work through the active loader; the package does not transpile TypeScript itself.

### Changed

- `mock.require` (and the `mockRequire` export) is now its own function: synchronous and require-only, as documented, but no longer the same function reference as the default export `mock`. Calling it behaves exactly as before.
- Bare CommonJS requests now resolve from the registration caller. Separate installed copies no longer share a mock merely because the library resolves one copy from its own directory.
- `reRequire()` and `reImport()` refresh only the requested module. Cached dependencies keep their existing instances.
