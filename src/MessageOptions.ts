const brand: unique symbol = Symbol('MessageOptions');

class MessageOptions {
  readonly transfer?;

  // This ensures that the class cannot be faked by structural typing.
  // This is necessary because Penpal uses an instanceof check to determine
  // if a value is, in fact, an instance of MessageOptions rather than just
  // being structurally similar.
  private [brand] = brand;

  constructor(options?: Pick<StructuredSerializeOptions, 'transfer'>) {
    this.transfer = options?.transfer;
  }
}

export default MessageOptions;
