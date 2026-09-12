export type MockExport = unknown;

/** A caller override for a wrapper registering, stopping, or refreshing a mock on behalf of another module. */
export interface ParentOptions {
  /** Absolute caller filename or file URL. */
  parentURL?: string;
}

export interface RequireOptions extends ParentOptions {
  lazy?: boolean;
}

export type ImportNamespace = Record<string, unknown>;
export type ImportReplacement = ImportNamespace | string;
export type ImportFactory = () => ImportNamespace;

export interface ImmediateImportOptions extends ParentOptions {
  lazy?: false;
  exports?: never;
}

export interface LazyImportOptions extends ParentOptions {
  lazy: true;
  /** Export names available before the factory evaluates. */
  exports: readonly string[];
}

export type ImportOptions = ImmediateImportOptions | LazyImportOptions;
export type BothNamespace = ImportNamespace;
export type BothReplacement = ImportReplacement;
export type BothFactory = ImportFactory;

export interface ImmediateBothOptions extends ParentOptions {
  mode: 'both';
  lazy?: false;
  exports?: never;
}

export interface LazyBothOptions extends ParentOptions {
  mode: 'both';
  lazy: true;
  /** Export names available before the factory evaluates. */
  exports: readonly string[];
}

export type BothOptions = ImmediateBothOptions | LazyBothOptions;
