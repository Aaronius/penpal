import { connect, debug, WindowMessenger } from 'penpal';
import { setEndpointState } from '../shared/ui.js';

type ParentMethods = {
  add: (num1: number, num2: number) => number;
};

if (!window.opener) {
  throw new Error('This page must be opened by the parent example.');
}

const messenger = new WindowMessenger({ remoteWindow: window.opener });
const connection = connect<ParentMethods>({
  messenger,
  log: debug('opened window'),
  methods: {
    multiply(num1: number, num2: number) {
      return num1 * num2;
    },
    divide(num1: number, num2: number) {
      return new Promise<number>((resolve) => {
        setTimeout(() => {
          resolve(num1 / num2);
        }, 250);
      });
    },
  },
});

const parentMethods = await connection.promise;
setEndpointState('Connected to opener');
await parentMethods.add(2, 6);
