import {getDebugEnabled, setDebugEnabled} from './logger';
import {getPromise, setPromise} from './promise';
import connectToChild from './connectToChild';
import connectToParent from './connectToParent';
import {
  ERR_CONNECTION_DESTROYED,
  ERR_CONNECTION_TIMEOUT,
  ERR_NOT_IN_IFRAME,
  ERR_IFRAME_ALREADY_ATTACHED_TO_DOM
} from './constants';

export default {
  ERR_CONNECTION_DESTROYED,
  ERR_CONNECTION_TIMEOUT,
  ERR_NOT_IN_IFRAME,
  ERR_IFRAME_ALREADY_ATTACHED_TO_DOM,
  get Promise() {
    return getPromise();
  },
  set Promise(value) {
    setPromise(value);
  },
  get debug() {
    return getDebugEnabled();
  },
  set debug(value) {
    setDebugEnabled(value);
  },
  connectToChild,
  connectToParent
};
