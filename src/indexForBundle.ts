import { connectToChild, connectToParent } from './connectToRemote';
import WindowMessenger from './messengers/WindowMessenger';
import WorkerMessenger from './messengers/WorkerMessenger';
import PortMessenger from './messengers/PortMessenger';
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
