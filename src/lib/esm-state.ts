import { isAbsolute } from 'path';
import { pathToFileURL } from 'url';
import type { ImportOptions } from '../types.ts';

export interface Ticket {
  key: string;
  order: number;
  generation: number;
}

interface Registration {
  id: number;
  url: string;
  value: unknown;
  lazy: boolean;
  names: readonly string[];
  control: Int32Array;
  result?: Record<string, unknown>;
}

export interface Metadata {
  id?: number;
  names?: string[];
  control?: Int32Array;
  target?: string;
}

const records = new Map<number, Registration>();
const owns = Object.prototype.hasOwnProperty;
const active = new Map<string, Metadata>();
const aliases = new Map<string, string>();
const orders = new Map<string, number>();
const mutations = new Map<string, number>();
const pending = new Map<number, string>();
const revisions = new Map<string, number>();
let sequence = 0;
let generation = 0;
let listener: (() => void) | undefined;
let loaderReady = false;
export const session = Math.random().toString(36).slice(2);

export function parentURL(caller: string): string {
  return caller.indexOf('file:') === 0 ? caller : pathToFileURL(caller).href;
}

export function keyFor(specifier: string, caller: string): string {
  if (isAbsolute(specifier)) return pathToFileURL(specifier).href;
  if (/^\.{1,2}[/\\]/.test(specifier)) return new URL(specifier.replace(/\\/g, '/'), parentURL(caller)).href;
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(specifier)) return specifier;
  return `${parentURL(caller)}\n${specifier}`;
}

export function begin(specifier: string, caller: string): Ticket {
  const key = keyFor(specifier, caller);
  const order = ++sequence;
  orders.set(key, order);
  pending.set(order, key);
  return { key, order, generation };
}

export function finish(ticket: Ticket): void {
  pending.delete(ticket.order);
  if (orders.get(ticket.key) === ticket.order) orders.delete(ticket.key);
  if (!pending.size) {
    orders.clear();
    mutations.clear();
  }
}

function changed() {
  if (listener) listener();
}

function retire(metadata: Metadata | undefined) {
  if (!metadata?.id) return;
  const record = records.get(metadata.id);
  // A selected but unevaluated module still needs its values even after synchronous cleanup.
  if (record && (record.result || Atomics.load(record.control, 1) !== 1)) records.delete(record.id);
}

function replace(url: string, metadata: Metadata, ticket: Ticket): boolean {
  if (ticket.generation !== generation || orders.get(ticket.key) !== ticket.order) return false;
  if ((mutations.get(url) || 0) > ticket.order) return false;
  mutations.set(url, ticket.order);
  retire(active.get(url));
  active.set(url, metadata);
  aliases.set(ticket.key, url);
  aliases.set(url, url);
  changed();
  return true;
}

export function add(url: string, value: unknown, options: ImportOptions, ticket: Ticket): number | undefined {
  if (options.lazy && typeof value !== 'function') throw new TypeError('A lazy import mock requires a factory function.');
  if (!options.lazy && (!value || typeof value !== 'object')) throw new TypeError('Import mocks require a namespace object, a replacement module string, or an explicitly lazy factory.');
  const names = options.lazy ? options.exports : Object.keys(value as object);
  if (!Array.isArray(names)) throw new TypeError('A lazy import mock requires options.exports.');
  const unique = names.filter((name, index) => names.indexOf(name) === index);
  unique.forEach((name) => {
    if (typeof name !== 'string' || !/^[$_\p{ID_Start}](?:[$_\p{ID_Continue}]|\u200C|\u200D)*$/u.test(name)) throw new TypeError(`Unsupported export name: ${String(name)}`);
  });
  const id = ++sequence;
  const control = new Int32Array(new SharedArrayBuffer(8));
  const record = { id, url, value, lazy: !!options.lazy, names: unique, control };
  records.set(id, record);
  if (replace(url, { id, names: unique, control }, ticket)) return id;
  records.delete(id);
  return undefined;
}

export function redirect(url: string, target: string, ticket: Ticket): boolean {
  const seen = new Set([url]);
  let next: string | undefined = target;
  while (next) {
    if (seen.has(next)) throw new Error('Import replacement cycle.');
    seen.add(next);
    next = active.get(next)?.target;
  }
  return replace(url, { target }, ticket);
}

export function get(id: number): Record<string, unknown> {
  const record = records.get(id);
  if (!record) throw new Error('Import mock registration is no longer available.');
  if (record.result) return record.result;
  try {
    const value = record.lazy ? (record.value as () => unknown)() : record.value;
    if (!value || typeof value !== 'object' || typeof (value as Promise<unknown>).then === 'function') throw new TypeError('Import factories must return a synchronous namespace object.');
    const result: Record<string, unknown> = Object.create(null);
    record.names.forEach((name) => {
      if (!owns.call(value, name)) throw new TypeError(`Import factory did not provide export: ${name}`);
      result[name] = (value as Record<string, unknown>)[name];
    });
    record.result = result;
    record.value = undefined;
    return result;
  } catch (error) {
    Atomics.add(record.control, 0, 1);
    throw error;
  } finally {
    Atomics.store(record.control, 1, 2);
    if (active.get(record.url)?.id !== id) records.delete(id);
  }
}

export function stop(specifier: string, caller: string): boolean {
  const key = keyFor(specifier, caller);
  const cancelled = new Set([key]);
  ++sequence;
  if (pending.size) orders.set(key, sequence);
  const url = aliases.get(key) || key;
  if (pending.size) mutations.set(url, sequence);
  const metadata = active.get(url);
  active.delete(url);
  aliases.forEach((target, alias) => {
    if (target === url) {
      cancelled.add(alias);
      if (pending.size) orders.set(alias, ++sequence);
      aliases.delete(alias);
    }
  });
  pending.forEach((key, order) => {
    if (cancelled.has(key)) pending.delete(order);
  });
  if (!pending.size) {
    orders.clear();
    mutations.clear();
  }
  retire(metadata);
  changed();
  return !!metadata;
}

export function stopAll(): void {
  generation++;
  pending.clear();
  const previous = Array.from(active.values());
  active.clear();
  aliases.clear();
  orders.clear();
  mutations.clear();
  previous.forEach(retire);
  changed();
}

export function refresh(url: string): number {
  const revision = ++sequence;
  revisions.set(url, revision);
  changed();
  return revision;
}

export function snapshot() {
  return { active: Array.from(active), revisions: Array.from(revisions), session };
}

export function subscribe(callback: () => void): void {
  listener = callback;
}

export function markLoader(): void {
  loaderReady = true;
}

export function hasLoader(): boolean {
  return loaderReady;
}
