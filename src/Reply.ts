import MessageOptions from './MessageOptions';

const brand: unique symbol = Symbol('Reply');

class Reply<T = unknown> {
  readonly returnValue: T;
  readonly messageOptions?;

  // This ensures that the class cannot be faked by structural typing.
  // This is necessary because Penpal uses an instanceof check to determine
  // if a value is, in fact, an instance of Reply rather than just being
  // structurally similar.
  private [brand] = brand;

  constructor(
    returnValue: T,
    messageOptions?:
      | ConstructorParameters<typeof MessageOptions>[0]
      | MessageOptions
  ) {
    this.returnValue = returnValue;
    this.messageOptions = new MessageOptions(messageOptions);
  }
}

export default Reply;
