import connectToChild from './parent/connectToChild';
import connectToParent from './child/connectToParent';
import {
  ERR_CONNECTION_DESTROYED,
  ERR_CONNECTION_TIMEOUT,
  ERR_NOT_IN_IFRAME,
  ERR_NO_IFRAME_SRC
} from './errorCodes';

export default {
  ERR_CONNECTION_DESTROYED,
  ERR_CONNECTION_TIMEOUT,
  ERR_NOT_IN_IFRAME,
  ERR_NO_IFRAME_SRC,
  connectToChild,
  connectToParent
};
