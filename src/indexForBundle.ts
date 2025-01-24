import connectToChild from './parent/connectToChild';
import connectToParent from './child/connectToParent';
import WindowMessenger from './WindowMessenger';
import WorkerMessenger from './WorkerMessenger';
import MethodCallOptions from './MethodCallOptions';
import Reply from './Reply';
import debug from './debug';
import { ErrorCode } from './enums';

export default {
  connectToChild,
  connectToParent,
  WindowMessenger,
  WorkerMessenger,
  MethodCallOptions,
  Reply,
  debug,
  ErrorCode,
};
