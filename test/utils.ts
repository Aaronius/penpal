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
  methods = {},
  pageName = 'general',
}: {
  methods?: Methods;
  pageName?: string;
} = {}) => {
  const connection = connectToChildIframe<TMethods>({
    iframe: createAndAddIframe(getPageFixtureUrl(pageName)),
    methods,
  });
  return connection;
};

export const createWorkerAndConnection = <TMethods extends Methods>({
  methods = {},
  workerName = 'general',
}: {
  methods?: Methods;
  workerName?: string;
} = {}) => {
  const worker = new Worker(getWorkerFixtureUrl(workerName));
  const connection = connectToChildWorker<TMethods>({
    worker,
    methods,
  });
  return connection;
};

export const getPageFixtureUrl = (pageName: string, server = CHILD_SERVER) => {
  return `${server}/pages/${pageName}.html`;
};

export const getWorkerFixtureUrl = (workerName: string) => {
  return `/base/test/childFixtures/workers/${workerName}.js`;
};
