import dependency from './dep.ts';
const read: () => string = () => dependency.value;
module.exports = { read };
