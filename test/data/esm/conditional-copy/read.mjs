import Module from 'module';
const require = Module.createRequire(import.meta.url);
export default async function read() {
  return [require('mrl-conditional-fixture').value, (await import('mrl-conditional-fixture')).value];
}
