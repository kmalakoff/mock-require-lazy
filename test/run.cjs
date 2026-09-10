'use strict';

var childProcess = require('child_process');
var path = require('path');

var command = process.execPath;
var cli = require.resolve('ts-dev-stack/bin/cli.js');
var env = {};
var key;
for (key in process.env) env[key] = process.env[key];
env.NODE_PATH = path.resolve('test/data/node-path');

var child = childProcess.spawn(command, [cli, 'test:node', '--no-timeouts'], {
  env: env,
  stdio: 'inherit',
});

child.on('close', function (code, signal) {
  if (signal) process.kill(process.pid, signal);
  process.exit(code === null ? 1 : code);
});
