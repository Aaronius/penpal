import connectToChild from './connectToChild';
import connectToParent from './connectToParent';
import {
  ERR_CONNECTION_DESTROYED,
  ERR_CONNECTION_TIMEOUT,
  ERR_NOT_IN_IFRAME,
  ERR_IFRAME_ALREADY_ATTACHED_TO_DOM
} from './errorCodes';

export default {
  ERR_CONNECTION_DESTROYED,
  ERR_CONNECTION_TIMEOUT,
  ERR_NOT_IN_IFRAME,
  ERR_IFRAME_ALREADY_ATTACHED_TO_DOM,
  connectToChild,
  connectToParent
};
