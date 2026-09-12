const dependency = require('./dep.cts');
const read: () => string = () => dependency.value;
module.exports = { read };
