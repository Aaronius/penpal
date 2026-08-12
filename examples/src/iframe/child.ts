import { connect, WindowMessenger } from 'penpal';
import { setEndpointState } from '../shared/ui.js';

type ParentMethods = {
  add: (num1: number, num2: number) => number;
};

const messenger = new WindowMessenger({ remoteWindow: window.parent });
const connection = connect<ParentMethods>({
  messenger,
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
setEndpointState('Connected to parent');
await parentMethods.add(2, 6);
