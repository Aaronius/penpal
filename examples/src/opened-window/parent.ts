import { WindowMessenger } from 'penpal';
import { connectParent } from '../shared/protocol.js';
import {
  createExampleUi,
  getRequiredElement,
  runExample,
} from '../shared/ui.js';

const ui = createExampleUi();
const openButton = getRequiredElement<HTMLButtonElement>('[data-open-window]');

ui.setState('ready', 'Ready');
openButton.addEventListener('click', () => {
  openButton.disabled = true;
  ui.setState('connecting', 'Connecting');

  runExample(ui, async () => {
    const remoteWindow = window.open('./child.html', 'penpal-example-window');

    if (!remoteWindow) {
      throw new Error('The browser blocked the example window.');
    }

    const messenger = new WindowMessenger({ remoteWindow });
    await connectParent(messenger, ui.reportResult);
    ui.setState('connected', 'Connected');
  });
});
