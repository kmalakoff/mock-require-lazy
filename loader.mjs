import Module from 'module';
import { isAbsolute } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import workerThreads from 'worker_threads';
import state from './dist/cjs/lib/esm-state.js';

const stateURL = new URL('./dist/cjs/lib/esm-state.js', import.meta.url).href;
const require = Module.createRequire(import.meta.url);
const prefix = 'mock-require-lazy:';
let requestId = 0;
let installed = false;
let readSnapshot = () => state.snapshot();
const versions = process.versions.node.split('.').map(Number);
const legacyHooks = versions[0] < 16 || (versions[0] === 16 && versions[1] < 12);

function connect(application, port) {
  const version = new Int32Array(new SharedArrayBuffer(4));
  application.subscribe(() => {
    const revision = Atomics.add(version, 0, 1) + 1;
    port.postMessage({ revision, snapshot: application.snapshot() });
  });
  application.markLoader();
  port.unref();
  return { version, snapshot: application.snapshot() };
}

function receive(port, initial) {
  let current = initial;
  let received = 0;
  const waiting = [];
  const wake = () => {
    for (let i = waiting.length - 1; i >= 0; i--) {
      if (current && waiting[i].revision <= received) waiting.splice(i, 1)[0].resolve();
    }
    if (!waiting.length) port.unref();
  };
  port.on('message', (message) => {
    if (message.initial) current = message.initial;
    else {
      current.snapshot = message.snapshot;
      received = message.revision;
    }
    wake();
  });
  port.unref();
  readSnapshot = async () => {
    if (!current)
      await new Promise((resolve) => {
        waiting.push({ revision: 0, resolve });
        port.ref();
      });
    const revision = Atomics.load(current.version, 0);
    if (received < revision)
      await new Promise((resolve) => {
        waiting.push({ revision, resolve });
        port.ref();
      });
    return current.snapshot;
  };
}

export function initialize(data) {
  if (data && data.port) {
    const { port, ...initial } = data;
    receive(port, initial);
  }
}

export function globalPreload(context) {
  if (!context || !context.port) return '';
  receive(context.port);
  return `const application = getBuiltin('module').createRequire(${JSON.stringify(import.meta.url)})(${JSON.stringify(fileURLToPath(stateURL))});
    port.postMessage({initial: (${connect.toString()})(application, port)});`;
}

function ensureHooks() {
  if (installed || state.hasLoader()) return;
  const [major, minor, patch] = process.versions.node.split('.').map(Number);
  const reliableSync = major > 22 || (major === 22 && (minor > 22 || (minor === 22 && patch >= 3)));
  if (typeof Module.registerHooks === 'function' && reliableSync) {
    Module.registerHooks({ resolve: resolveSync, load: loadSync });
    state.markLoader();
  } else if (typeof Module.register === 'function') {
    const { port1, port2 } = new workerThreads.MessageChannel();
    const initial = connect(state, port1);
    Module.register(import.meta.url, { data: { port: port2, ...initial }, transferList: [port2] });
  } else {
    throw new Error('Import mocking needs a startup loader on this Node version. Start Node with --loader=mock-require-lazy/loader.');
  }
  installed = true;
}

function stripRevision(url, session) {
  if (!url || !url.startsWith('file:')) return url;
  return url.replace(new RegExp(`[?&]__mrl_${session}=\\d+(?=#|$)`), '');
}

function withRevision(url, revision, session) {
  const index = url.indexOf('#');
  const base = index < 0 ? url : url.slice(0, index);
  return `${base}${base.includes('?') ? '&' : '?'}__mrl_${session}=${revision}${index < 0 ? '' : url.slice(index)}`;
}

function virtualURL(specifier, parentURL) {
  if (isAbsolute(specifier)) return pathToFileURL(specifier).href;
  if (/^\.{1,2}[/\\]/.test(specifier)) return new URL(specifier.replace(/\\/g, '/'), parentURL).href;
  if (specifier.startsWith('file:')) return specifier;
  return `${prefix}virtual/${encodeURIComponent(specifier)}`;
}

function* hostResolve(specifier, context) {
  try {
    return yield ['resolve', specifier, context];
  } catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND' && error.code !== 'MODULE_NOT_FOUND') throw error;
    return { url: virtualURL(specifier, context.parentURL), missing: error };
  }
}

function* resolveSteps(specifier, context) {
  state.markLoader();
  const snapshot = yield ['snapshot'];
  if (specifier.startsWith(`${prefix}identify/`)) {
    const request = JSON.parse(decodeURIComponent(specifier.slice(`${prefix}identify/`.length)));
    const result = yield* hostResolve(request.specifier, { ...context, parentURL: request.parentURL, conditions: ['node', 'import', ...context.conditions.filter((condition) => condition !== 'require' && condition !== 'import' && condition !== 'node')] });
    const value = { url: result.url, format: result.format, missing: !!result.missing };
    return { url: `${prefix}identity/${encodeURIComponent(JSON.stringify(value))}`, format: 'module', shortCircuit: true };
  }
  const parentURL = context.parentURL && context.parentURL.startsWith(prefix) ? import.meta.url : stripRevision(context.parentURL, snapshot.session);
  const result = yield* hostResolve(specifier, { ...context, parentURL });
  if (result.url === stateURL || context.conditions.includes('require')) {
    if (result.missing) throw result.missing;
    return result;
  }
  const original = stripRevision(result.url, snapshot.session);
  const active = new Map(snapshot.active);
  let metadata = active.get(original);
  let target = original;
  const seen = new Set();
  while (metadata && metadata.target) {
    if (seen.has(target)) throw new Error('Import replacement cycle.');
    seen.add(target);
    target = metadata.target;
    metadata = active.get(target);
  }
  if (metadata && metadata.id) {
    Atomics.store(metadata.control, 1, 1);
    const value = { id: metadata.id, attempt: Atomics.load(metadata.control, 0), names: metadata.names, session: snapshot.session };
    return { url: `${prefix}value/${encodeURIComponent(JSON.stringify(value))}`, format: 'module', shortCircuit: true };
  }
  if (target !== original) return { ...(yield ['resolve', target, context]), shortCircuit: true };
  if (result.missing) throw result.missing;
  const revision = new Map(snapshot.revisions).get(original);
  if (revision && original === result.url) return { ...result, url: withRevision(original, revision, snapshot.session), shortCircuit: true };
  return result;
}

export async function resolve(specifier, context, next) {
  const steps = resolveSteps(specifier, context);
  let step = steps.next();
  while (!step.done) {
    try {
      const [kind, request, options] = step.value;
      step = steps.next(await (kind === 'snapshot' ? readSnapshot() : next(request, options)));
    } catch (error) {
      step = steps.throw(error);
    }
  }
  return step.value;
}

function resolveSync(specifier, context, next) {
  const steps = resolveSteps(specifier, context);
  let step = steps.next();
  while (!step.done) {
    try {
      const [kind, request, options] = step.value;
      step = steps.next(kind === 'snapshot' ? state.snapshot() : next(request, options));
    } catch (error) {
      step = steps.throw(error);
    }
  }
  return step.value;
}

function generatedSource(url) {
  if (url.startsWith(`${prefix}identity/`)) return `export default ${decodeURIComponent(url.slice(`${prefix}identity/`.length))};`;
  if (!url.startsWith(`${prefix}value/`)) return undefined;
  const value = JSON.parse(decodeURIComponent(url.slice(`${prefix}value/`.length)));
  return `import state from ${JSON.stringify(stateURL)}; const value = state.get(${value.id});\n${value.names.map((name, i) => `const v${i} = value[${JSON.stringify(name)}]; export { v${i} as ${name} };`).join('\n')}`;
}

function loadSync(url, context, next) {
  const source = generatedSource(url);
  if (source !== undefined) return { format: 'module', source, shortCircuit: true };
  return next(stripRevision(url, state.session), context);
}

export async function load(url, context, next) {
  const source = generatedSource(url);
  if (source !== undefined) return { format: 'module', source, shortCircuit: true };
  const snapshot = await readSnapshot();
  return next(stripRevision(url, snapshot.session), context);
}

export const getFormat = legacyHooks
  ? async function getFormat(url, context, next) {
      if (generatedSource(url) !== undefined) return { format: 'module' };
      return next(stripRevision(url, (await readSnapshot()).session), context);
    }
  : undefined;

export const getSource = legacyHooks
  ? async function getSource(url, context, next) {
      const source = generatedSource(url);
      if (source !== undefined) return { source };
      return next(stripRevision(url, (await readSnapshot()).session), context);
    }
  : undefined;

async function identify(specifier, parentURL) {
  ensureHooks();
  const request = isAbsolute(specifier) ? pathToFileURL(specifier).href : specifier;
  return (await import(`${prefix}identify/${encodeURIComponent(JSON.stringify({ specifier: request, parentURL, id: ++requestId }))}`)).default;
}

export async function register(specifier, replacement, options, parentURL, ticket) {
  if (options.lazy && typeof replacement !== 'function') throw new TypeError('A lazy import mock requires a factory function.');
  const { url } = await identify(specifier, parentURL);
  if (typeof replacement === 'string') {
    const target = await identify(replacement, parentURL);
    if (target.missing) throw new Error(`Replacement module not found: ${replacement}`);
    state.redirect(url, target.url, ticket);
  } else state.add(url, replacement, options, ticket);
}

export async function refresh(specifier, parentURL) {
  const { url, format, missing } = await identify(specifier, parentURL);
  if (missing) return import(url);
  if (url.startsWith('node:')) return import(url);
  if (!url.startsWith('file:')) throw new TypeError('reImport supports file modules and builtins.');
  const filename = fileURLToPath(url);
  delete require.cache[filename];
  // CommonJS refresh must use its loader, including registered TypeScript transforms and require mocks.
  if (!new Map(state.snapshot().active).has(url) && (format === 'commonjs' || format === 'commonjs-typescript')) require(filename);
  const revision = state.refresh(url);
  return import(withRevision(url, revision, state.session));
}
