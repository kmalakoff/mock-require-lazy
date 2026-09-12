const { execFileSync } = require('child_process');
const { dirname, join } = require('path');

const tsds = join(dirname(require.resolve('ts-dev-stack/package.json')), 'bin', 'cli.js');
const nvu = join(dirname(require.resolve('node-version-use/package.json')), 'bin', 'cli.js');
const versions = '12.22.0,16.11.1,16.12.0,16.16.0,16.17.0,18.5.0,18.6.0,18.18.2,18.19.0,20.0.0,20.5.1,20.6.0,22.14.0,22.15.0,22.22.2,22.22.3';
const options = { stdio: 'inherit', cwd: join(__dirname, '..') };

// The TS resolver needs the same self-package link that tsds test:node supplies.
execFileSync(process.execPath, [tsds, 'link'], options);
try {
  execFileSync(process.execPath, [nvu, versions, 'node', 'test/integration/esm-boundaries.cjs'], options);
} finally {
  execFileSync(process.execPath, [tsds, 'unlink'], options);
}
