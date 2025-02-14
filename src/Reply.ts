const brand: unique symbol = Symbol('Reply');

class Reply<T = unknown> {
  readonly value: T;
  readonly transferables?: Transferable[];

  // Allows TypeScript to distinguish between an actual instance of this
  // class versus an object that looks structurally similar.
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
