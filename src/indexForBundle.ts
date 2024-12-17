import connectToChildIframe from './parent/connectToChildIframe';
import connectToParentFromIframe from './child/connectToParentFromIframe';
import { default as MethodCallOptions } from './MethodCallOptions';
import { default as Reply } from './Reply';
import { ErrorCode } from './enums';

export default {
  connectToChildIframe,
  connectToParentFromIframe,
  MethodCallOptions,
  Reply,
  ErrorCode,
};
