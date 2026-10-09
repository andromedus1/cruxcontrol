export type CatalogFailureCode =
  | 'unsupported' | 'busy' | 'closed' | 'manifest' | 'network' | 'aborted'
  | 'digest' | 'size' | 'decompression' | 'schema' | 'storage';

export class CatalogBootstrapError extends Error {
  readonly code: CatalogFailureCode;

  constructor(code: CatalogFailureCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'CatalogBootstrapError';
    this.code = code;
    Object.setPrototypeOf(this, CatalogBootstrapError.prototype);
  }
}
