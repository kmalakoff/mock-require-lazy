export type MockExport = unknown;

export interface RequireOptions {
  lazy?: boolean;
}

export interface ImportOptions {
  lazy?: boolean;
  /** Export names available before a lazy factory evaluates. */
  exports?: string[];
  /** Absolute caller filename or file URL, for wrappers registering on behalf of another module. */
  parentURL?: string;
}
