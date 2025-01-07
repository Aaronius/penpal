import {
  connectToChildIframe,
  connectToChildWorker,
  Methods,
} from '../src/index';
import { CHILD_SERVER } from './constants';

export const createAndAddIframe = (url?: string) => {
  const iframe = document.createElement('iframe');
  if (url) {
    iframe.src = url;
  }
  document.body.appendChild(iframe);
  return iframe;
};

export const createIframeAndConnection = <TMethods extends Methods>({
  methods,
}: {
  methods?: Methods;
} = {}) => {
  const connection = connectToChildIframe<TMethods>({
    iframe: createAndAddIframe(`${CHILD_SERVER}/pages/default.html`),
    methods,
  });
  return connection;
};

export const createWorkerAndConnection = <TMethods extends Methods>({
  methods = {},
}: {
  methods?: Methods;
} = {}) => {
  const worker = new Worker(getWorkerFixtureUrl('default'));
  const connection = connectToChildWorker<TMethods>({
    worker,
    methods,
  });
  return connection;
};

export const getWorkerFixtureUrl = (name: string) => {
  return `/base/test/childFixtures/workers/${name}.js`;
};
