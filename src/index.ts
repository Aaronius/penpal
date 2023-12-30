export { default as connectToChildIframe } from './parent/connectToChildIframe';
export { default as connectToParentFromIframe } from './child/connectToParentFromIframe';
export { default as connectToChildWorker } from './parent/connecToChildWorker';
export { default as connectToParentFromWorker } from './child/connectToParentFromWorker';
export { default as MessageOptions } from './MessageOptions';
export { default as withMessageOptions } from './withMessageOptions';

export { ErrorCode } from './enums';
export {
  Connection,
  AsyncMethodReturns,
  CallSender,
  Methods,
  PenpalError,
} from './types';
