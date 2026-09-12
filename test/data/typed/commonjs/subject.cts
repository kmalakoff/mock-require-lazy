import dependency from './dep.cts';
const read: () => string = () => dependency.value;
module.exports = { read };
