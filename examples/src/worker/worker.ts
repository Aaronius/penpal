import { connect, debug, WorkerMessenger } from 'penpal';

type WindowMethods = {
  add: (num1: number, num2: number) => number;
};

const messenger = new WorkerMessenger({ worker: globalThis });
const connection = connect<WindowMethods>({
  messenger,
  log: debug('dedicated worker'),
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

const windowMethods = await connection.promise;
await windowMethods.add(2, 6);
