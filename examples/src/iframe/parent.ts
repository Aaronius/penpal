import { WindowMessenger } from 'penpal';
import { connectParent } from '../shared/protocol.js';
import {
  createExampleUi,
  getRequiredElement,
  runExample,
} from '../shared/ui.js';

const ui = createExampleUi();

runExample(ui, async () => {
  const iframe = getRequiredElement<HTMLIFrameElement>('[data-remote-frame]');
  const remoteWindow = iframe.contentWindow;

  if (!remoteWindow) {
    throw new Error('The iframe window is unavailable.');
  }

  const messenger = new WindowMessenger({ remoteWindow });
  await connectParent(messenger, ui.reportResult);
  ui.setState('connected', 'Connected');
});
