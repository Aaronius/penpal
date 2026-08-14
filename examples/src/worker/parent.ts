import { connect, debug, WorkerMessenger } from 'penpal';
import { createExampleUi } from '../shared/ui.js';

type WorkerMethods = {
  multiply: (num1: number, num2: number) => number;
  divide: (num1: number, num2: number) => Promise<number>;
};

const ui = createExampleUi();

const run = async (): Promise<void> => {
  const worker = new Worker(new URL('./worker.js', import.meta.url), {
    type: 'module',
  });
  const messenger = new WorkerMessenger({ worker });
  const connection = connect<WorkerMethods>({
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

  const workerMethods = await connection.promise;
  ui.setState('connected', 'Connected');

  const multiplicationResult = await workerMethods.multiply(2, 6);
  ui.reportResult('multiply', multiplicationResult);

  const divisionResult = await workerMethods.divide(12, 4);
  ui.reportResult('divide', divisionResult);
};

void run().catch((error: unknown) => {
  ui.fail(error);
});
