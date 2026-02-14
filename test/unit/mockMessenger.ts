import type { Message } from '../../src/types.js';
import type Messenger from '../../src/messengers/Messenger.js';
import type {
  InitializeMessengerOptions,
  MessageHandler,
} from '../../src/messengers/Messenger.js';

export class MockMessenger implements Messenger {
  readonly sentMessages: Message[] = [];
  readonly handlers = new Set<MessageHandler>();
  readonly initializeCalls: InitializeMessengerOptions[] = [];
  readonly destroy = () => {
    // no-op for tests
  };
  sendMessageImpl: (
    message: Message,
    transferables?: Transferable[]
  ) => void = () => {
    // no-op for tests
  };

  initialize = (options: InitializeMessengerOptions) => {
    this.initializeCalls.push(options);
  };

  sendMessage = (message: Message, transferables?: Transferable[]) => {
    this.sentMessages.push(message);
    this.sendMessageImpl(message, transferables);
  };

  addMessageHandler = (callback: MessageHandler) => {
    this.handlers.add(callback);
  };

  removeMessageHandler = (callback: MessageHandler) => {
    this.handlers.delete(callback);
  };

  emit = async (message: Message) => {
    for (const handler of this.handlers) {
      await ((handler as unknown) as (message: Message) => Promise<void>)(
        message
      );
    }
  };
}
