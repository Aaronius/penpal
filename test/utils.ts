import {
  connectToChildIframe,
  connectToChildWorker,
  Methods,
} from '../src/index';
import { CHILD_SERVER, WORKER_URL_PATH } from './constants';

export const createAndAddIframe = (url?: string) => {
  const iframe = document.createElement('iframe');
  if (url) {
    iframe.src = url;
  }
  document.body.appendChild(iframe);
  return iframe;
};

export const createIframeAndConnection = <TCallSender extends object>({
  methods,
}: {
  methods?: Methods;
} = {}) => {
  const connection = connectToChildIframe<TCallSender>({
    iframe: createAndAddIframe(`${CHILD_SERVER}/pages/default.html`),
    methods,
  });
  return connection;
};

export const createWorkerAndConnection = <TCallSender extends object>({
  methods = {},
}: {
  methods?: Methods;
} = {}) => {
  const worker = new Worker(WORKER_URL_PATH);
  const connection = connectToChildWorker<TCallSender>({
    worker,
    methods,
  });
  return connection;
};
