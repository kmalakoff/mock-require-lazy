'use strict';

const a = require('module-a');

module.exports = {
  id: 'local-module-a',
  dependentOn: a
};
