import connectToChildIframe from './parent/connectToChildIframe';
import connectToParentFromIframe from './child/connectToParentFromIframe';
import { default as MessageOptions } from './MessageOptions';
import { default as Reply } from './Reply';
import { ErrorCode } from './enums';

export default {
  connectToChildIframe,
  connectToParentFromIframe,
  MessageOptions,
  Reply,
  ErrorCode,
};
