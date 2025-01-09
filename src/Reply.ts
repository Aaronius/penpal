const brand: unique symbol = Symbol('Reply');

class Reply<T = unknown> {
  readonly returnValue: T;
  readonly transferables?: Transferable[];

  // This ensures that the class cannot be faked by structural typing.
  // This is necessary because Penpal uses an instanceof check to determine
  // if a value is, in fact, an instance of Reply rather than just being
  // structurally similar.
  private [brand] = brand;

  constructor(
    returnValue: T,
    options?: {
      transferables?: Transferable[];
    }
  ) {
    this.returnValue = returnValue;
    this.transferables = options?.transferables;
  }
}

export default Reply;
