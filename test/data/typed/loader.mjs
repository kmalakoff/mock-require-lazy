import * as mocking from 'mock-require-lazy/loader';
import * as typescript from 'ts-swc-loaders';

const typed = (specifier) => /\.[cm]?ts(?:[?#]|$)/.test(specifier);
export const resolve = (specifier, context, next) => mocking.resolve(specifier, context, (specifier, context) => typed(specifier) ? typescript.resolve(specifier, context, next) : next(specifier, context));
export const load = (url, context, next) => mocking.load(url, context, (url, context) => typed(url) ? typescript.load(url, context, next) : next(url, context));
export const getFormat = typeof mocking.getFormat === 'function' ? (url, context, next) => mocking.getFormat(url, context, (url, context) => typed(url) ? typescript.getFormat(url, context, next) : next(url, context)) : undefined;
export const getSource = mocking.getSource;
export const transformSource = typeof typescript.transformSource === 'function' ? (source, context, next) => typed(context.url) ? typescript.transformSource(source, context, next) : next(source, context) : undefined;
export const globalPreload = mocking.globalPreload;
