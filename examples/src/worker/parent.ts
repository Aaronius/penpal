import { WorkerMessenger } from 'penpal';
import { connectParent } from '../shared/protocol.js';
import { createExampleUi, runExample } from '../shared/ui.js';

const ui = createExampleUi();

runExample(ui, async () => {
  const worker = new Worker(new URL('./worker.js', import.meta.url), {
    type: 'module',
  });
  const messenger = new WorkerMessenger({ worker });
  await connectParent(messenger, ui.reportResult);
  ui.setState('connected', 'Connected');
});
