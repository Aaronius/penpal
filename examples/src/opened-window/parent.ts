import { connect, debug, WindowMessenger } from 'penpal';
import { createExampleUi, getRequiredElement } from '../shared/ui.js';

type OpenedWindowMethods = {
  multiply: (num1: number, num2: number) => number;
  divide: (num1: number, num2: number) => Promise<number>;
};

const ui = createExampleUi();
const openButton = getRequiredElement<HTMLButtonElement>('[data-open-window]');

ui.setState('ready', 'Ready');
const connectToOpenedWindow = async (): Promise<void> => {
  const remoteWindow = window.open('./child.html', 'penpal-example-window');

  if (!remoteWindow) {
    throw new Error('The browser blocked the example window.');
  }

  const messenger = new WindowMessenger({ remoteWindow });
  const connection = connect<OpenedWindowMethods>({
    messenger,
    log: debug('opener window'),
    methods: {
      add(num1: number, num2: number) {
        const result = num1 + num2;
        ui.reportResult('add', result);
        return result;
      },
    },
  });

  const openedWindowMethods = await connection.promise;
  ui.setState('connected', 'Connected');

  const multiplicationResult = await openedWindowMethods.multiply(2, 6);
  ui.reportResult('multiply', multiplicationResult);

  const divisionResult = await openedWindowMethods.divide(12, 4);
  ui.reportResult('divide', divisionResult);
};

openButton.addEventListener('click', () => {
  openButton.disabled = true;
  ui.setState('connecting', 'Connecting');

  void connectToOpenedWindow().catch((error: unknown) => {
    ui.fail(error);
  });
});
