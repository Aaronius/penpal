const brand: unique symbol = Symbol('MethodCallOptions');

class MethodCallOptions {
  readonly transferables?: Transferable[];
  readonly timeout?: number;

  // This ensures that the class cannot be faked by structural typing.
  // This is necessary because Penpal uses an instanceof check to determine
  // if a value is, in fact, an instance of MethodCallOptions rather than just
  // being structurally similar.
  private [brand] = brand;

  constructor(options?: { transferables?: Transferable[]; timeout?: number }) {
    this.transferables = options?.transferables;
    this.timeout = options?.timeout;
  }
}

export default MethodCallOptions;
