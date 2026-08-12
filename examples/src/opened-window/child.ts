import { WindowMessenger } from 'penpal';
import { connectRemote } from '../shared/protocol.js';
import { setEndpointState } from '../shared/ui.js';

if (!window.opener) {
  throw new Error('This page must be opened by the parent example.');
}

const messenger = new WindowMessenger({ remoteWindow: window.opener });
await connectRemote(messenger);
setEndpointState('Connected to opener');
