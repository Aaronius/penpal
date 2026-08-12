import { WorkerMessenger } from 'penpal';
import { connectRemote } from '../shared/protocol.js';

const messenger = new WorkerMessenger({ worker: globalThis });
await connectRemote(messenger);
