const brand: unique symbol = Symbol('CallOptions');

class CallOptions {
  readonly transferables?: Transferable[];
  readonly timeout?: number;

  // Allows TypeScript to distinguish between an actual instance of this
  // class versus an object that looks structurally similar.
  // eslint-disable-next-line no-unused-private-class-members
  #brand = brand;

  constructor(options?: { transferables?: Transferable[]; timeout?: number }) {
    this.transferables = options?.transferables;
    this.timeout = options?.timeout;
  }
}

export default CallOptions;
