import { connect, debug, WindowMessenger } from 'penpal';
import { createExampleUi, getRequiredElement } from '../shared/ui.js';

type IframeMethods = {
  multiply: (num1: number, num2: number) => number;
  divide: (num1: number, num2: number) => Promise<number>;
};

const ui = createExampleUi();

const run = async (): Promise<void> => {
  const iframe = getRequiredElement<HTMLIFrameElement>('[data-remote-frame]');
  const remoteWindow = iframe.contentWindow;

  if (!remoteWindow) {
    throw new Error('The iframe window is unavailable.');
  }

  const messenger = new WindowMessenger({ remoteWindow });
  const connection = connect<IframeMethods>({
    messenger,
    log: debug('parent window'),
    methods: {
      add(num1: number, num2: number) {
        const result = num1 + num2;
        ui.reportResult('add', result);
        return result;
      },
    },
  });

  const iframeMethods = await connection.promise;
  ui.setState('connected', 'Connected');

  const multiplicationResult = await iframeMethods.multiply(2, 6);
  ui.reportResult('multiply', multiplicationResult);

  const divisionResult = await iframeMethods.divide(12, 4);
  ui.reportResult('divide', divisionResult);
};

void run().catch((error: unknown) => {
  ui.fail(error);
});
