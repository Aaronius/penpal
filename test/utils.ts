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

export const createIframeAndConnection = ({
  methods,
}: {
  methods?: Methods;
} = {}) => {
  const connection = connectToChildIframe({
    iframe: createAndAddIframe(`${CHILD_SERVER}/default.html`),
    methods,
  });
  return connection;
};

export const createWorkerAndConnection = ({
  methods = {},
}: {
  methods?: Methods;
} = {}) => {
  const worker = new Worker(WORKER_URL_PATH);
  const connection = connectToChildWorker({
    worker,
    methods,
  });
  return connection;
};
