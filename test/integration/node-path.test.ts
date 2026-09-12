import assert from 'assert';
import { execFile } from 'child_process';
import { dirname, join } from 'path';
import url from 'url';

const testDirectory = typeof __dirname === 'undefined' ? dirname(url.fileURLToPath(import.meta.url)) : __dirname;
const packageRoot = join(testDirectory, '..', '..');
const fixture = join(packageRoot, 'test', 'data', 'node-path', 'compatibility.cjs');
const nodePath = join(packageRoot, 'test', 'data', 'node-path');

describe('NODE_PATH CommonJS compatibility', () => {
  it('matches bare and relative requests for immediate and lazy mocks', (done) => {
    let output = '';
    let errorOutput = '';
    execFile(
      process.execPath,
      [fixture],
      {
        env: { ...process.env, NODE_PATH: nodePath },
        encoding: 'utf8',
        maxBuffer: 1024 * 1024,
      },
      (error, stdout, stderr) => {
        output = stdout;
        errorOutput = stderr;

        if (error) {
          done(new Error(`NODE_PATH child failed: ${error.message}\n${output}${errorOutput}`));
          return;
        }

        try {
          assert.ok(/node-path cjs compatibility complete/.test(output));
          if (errorOutput) process.stderr.write(errorOutput);
          done();
        } catch (assertionError) {
          done(assertionError);
        }
      }
    );
  });
});
