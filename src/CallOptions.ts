const brand: unique symbol = Symbol('CallOptions');

class CallOptions {
  readonly transferables: Transferable[] | undefined;
  readonly timeout: number | undefined;

  // Allows TypeScript to distinguish between an actual instance of this
  // class versus an object that looks structurally similar.
  // eslint-disable-next-line no-unused-private-class-members
  #brand = brand;

  constructor(options?: {
    transferables?: Transferable[] | undefined;
    timeout?: number | undefined;
  }) {
    this.transferables = options?.transferables;
    this.timeout = options?.timeout;
  }
}

export default CallOptions;
