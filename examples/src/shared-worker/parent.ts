import { connect, debug, PortMessenger } from 'penpal';
import { createExampleUi } from '../shared/ui.js';

type SharedWorkerMethods = {
  multiply: (num1: number, num2: number) => number;
  divide: (num1: number, num2: number) => Promise<number>;
};

const ui = createExampleUi();

const run = async (): Promise<void> => {
  const worker = new SharedWorker(
    new URL('./shared-worker.js', import.meta.url),
    { type: 'module' },
  );
  const messenger = new PortMessenger({ port: worker.port });
  const connection = connect<SharedWorkerMethods>({
    messenger,
    log: debug('window'),
    methods: {
      add(num1: number, num2: number) {
        const result = num1 + num2;
        ui.reportResult('add', result);
        return result;
      },
    },
  });

  const sharedWorkerMethods = await connection.promise;
  ui.setState('connected', 'Connected');

  const multiplicationResult = await sharedWorkerMethods.multiply(2, 6);
  ui.reportResult('multiply', multiplicationResult);

  const divisionResult = await sharedWorkerMethods.divide(12, 4);
  ui.reportResult('divide', divisionResult);
};

void run().catch((error: unknown) => {
  ui.fail(error);
});
