import MessageOptions from './MessageOptions';

class Reply {
  readonly returnValue: unknown;
  readonly messageOptions?: MessageOptions;

  constructor(returnValue: unknown, messageOptions?: MessageOptions) {
    this.returnValue = returnValue;
    this.messageOptions = messageOptions;
  }
}

export default Reply;
