'use strict';

var a = require('./module-a.cjs');

module.exports = {
  id: 'local-module-b',
  dependentOn: a,
};
