import { PortMessenger } from 'penpal';
import { connectParent } from '../shared/protocol.js';
import { createExampleUi, runExample } from '../shared/ui.js';

const ui = createExampleUi();

runExample(ui, async () => {
  const worker = new SharedWorker(
    new URL('./shared-worker.js', import.meta.url),
    { type: 'module' },
  );
  const messenger = new PortMessenger({ port: worker.port });
  await connectParent(messenger, ui.reportResult);
  ui.setState('connected', 'Connected');
});
