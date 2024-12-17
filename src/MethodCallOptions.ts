const brand: unique symbol = Symbol('MethodCallOptions');

class MethodCallOptions {
  readonly transfer?: Transferable[];
  readonly timeout?: number;

  // This ensures that the class cannot be faked by structural typing.
  // This is necessary because Penpal uses an instanceof check to determine
  // if a value is, in fact, an instance of MethodCallOptions rather than just
  // being structurally similar.
  private [brand] = brand;

  constructor(options?: {
    // Named transfer instead of transferables to match the native
    // postMessage API
    transfer?: Transferable[];
    timeout?: number;
  }) {
    this.transfer = options?.transfer;
    this.timeout = options?.timeout;
  }
}

export default MethodCallOptions;
