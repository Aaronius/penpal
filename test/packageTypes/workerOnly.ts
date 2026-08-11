import { WorkerMessenger, connect, type Methods } from 'penpal';

interface RemoteMethods extends Methods {
  add(left: number, right: number): number;
}

const messenger = new WorkerMessenger({ worker: self });
const connection = connect<RemoteMethods>({ messenger });

void connection;
