type Options = Pick<StructuredSerializeOptions, 'transfer'>;

class MessageOptions {
  readonly transfer: Options['transfer'];

  constructor(options: Options) {
    this.transfer = options.transfer;
  }
}

export default MessageOptions;
