const { execFileSync } = require('child_process');
const Module = require('module');
const { join, dirname } = require('path');
const { pathToFileURL } = require('url');

// Native entry points avoid the test runner's TypeScript-loader gaps on early Node 16.
const esm = join(__dirname, '..', 'data', 'esm', 'run.mjs');
const typed = join(__dirname, '..', 'data', 'typed');
const loader = pathToFileURL(require.resolve('mock-require-lazy/loader')).href;
const cli = join(dirname(require.resolve('ts-swc-loaders/package.json')), 'bin', 'cli.js');
const automatic = typeof Module.register === 'function' || typeof Module.registerHooks === 'function';
const versions = process.versions.node.split('.').map(Number);
function run(args, cwd) {
  execFileSync(process.execPath, args, { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '' }, cwd });
}
run(['--loader', loader, esm]);
if (automatic) run([esm]);
run([join(typed, 'require.cjs')], typed);
// ts-swc-loaders has no legacy getFormat hook on Node 16.0–16.11; compiled ESM is covered above.
if (!(versions[0] === 16 && versions[1] < 12)) {
  run(automatic ? [cli, 'node', join(typed, 'import.mjs')] : ['--loader', pathToFileURL(join(typed, 'loader.mjs')).href, join(typed, 'import.mjs')], typed);
}
