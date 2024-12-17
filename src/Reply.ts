const brand: unique symbol = Symbol('Reply');

class Reply<T = unknown> {
  readonly returnValue: T;
  readonly transfer?: Transferable[];

  // This ensures that the class cannot be faked by structural typing.
  // This is necessary because Penpal uses an instanceof check to determine
  // if a value is, in fact, an instance of Reply rather than just being
  // structurally similar.
  private [brand] = brand;

  constructor(
    returnValue: T,
    options?: {
      // Named transfer instead of transferables to match the native
      // postMessage API
      transfer?: Transferable[];
    }
  ) {
    this.returnValue = returnValue;
    this.transfer = options?.transfer;
  }
}

export default Reply;
