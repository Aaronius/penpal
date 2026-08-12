import { WindowMessenger } from 'penpal';
import { connectRemote } from '../shared/protocol.js';
import { setEndpointState } from '../shared/ui.js';

const messenger = new WindowMessenger({ remoteWindow: window.parent });
await connectRemote(messenger);
setEndpointState('Connected to parent');
