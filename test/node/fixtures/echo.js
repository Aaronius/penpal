import { parentPort } from 'node:worker_threads';

parentPort.on('message', (value) => parentPort.postMessage(value));
