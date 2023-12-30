type Options = Pick<StructuredSerializeOptions, 'transfer'>;

class MessageOptions {
  readonly options: Options;

  constructor(options: Options) {
    this.options = options;
  }
}

export default MessageOptions;
