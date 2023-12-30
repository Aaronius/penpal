import connectToChildIframe from './parent/connectToChildIframe';
import connectToParentFromIframe from './child/connectToParentFromIframe';
import { default as MessageOptions } from './MessageOptions';
import { default as withMessageOptions } from './withMessageOptions';
import { ErrorCode } from './enums';

export default {
  connectToChildIframe,
  connectToParentFromIframe,
  MessageOptions,
  withMessageOptions,
  ErrorCode,
};
