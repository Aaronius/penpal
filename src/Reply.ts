const brand: unique symbol = Symbol('Reply');

class Reply<T = unknown> {
  readonly value: T;
  readonly transferables?: Transferable[];

  // This ensures that the class cannot be faked by structural typing.
  // This is necessary because Penpal uses an instanceof check to determine
  // if a value is, in fact, an instance of Reply rather than just being
  // structurally similar.
  private [brand] = brand;

  constructor(
    value: T,
    options?: {
      transferables?: Transferable[];
    }
  ) {
    this.value = value;
    this.transferables = options?.transferables;
  }
}

export default Reply;
