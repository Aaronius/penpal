import { connectToChild, connectToParent } from './connectToRemote';
import WindowMessenger from './WindowMessenger';
import WorkerMessenger from './WorkerMessenger';
import PortMessenger from './PortMessenger';
import MethodCallOptions from './MethodCallOptions';
import Reply from './Reply';
import debug from './debug';
import { ErrorCode } from './enums';

export default {
  connectToChild,
  connectToParent,
  WindowMessenger,
  WorkerMessenger,
  PortMessenger,
  MethodCallOptions,
  Reply,
  debug,
  ErrorCode,
};
