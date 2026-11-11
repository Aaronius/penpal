import type { Message } from '../../src/types.js';
import type Messenger from '../../src/messengers/Messenger.js';
import type { InitializeMessengerOptions } from '../../src/messengers/Messenger.js';

export class MockMessenger implements Messenger {
  readonly sentMessages: Message[] = [];
  initializeOptions: InitializeMessengerOptions | undefined;

  destroy = () => {
    this.initializeOptions = undefined;
  };

  sendMessageImpl: (message: Message, transferables?: Transferable[]) => void =
    () => {
      // no-op for tests
    };

  initialize = (options: InitializeMessengerOptions) => {
    this.initializeOptions = options;
  };

  sendMessage = (message: Message, transferables?: Transferable[]) => {
    this.sentMessages.push(message);
    this.sendMessageImpl(message, transferables);
  };

  emit = (message: unknown): void => {
    if (this.initializeOptions?.validateReceivedMessage(message)) {
      this.initializeOptions.onMessage(message);
    }
  };
}
