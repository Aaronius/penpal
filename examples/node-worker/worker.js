import { parentPort } from 'node:worker_threads';
import { PortMessenger, connect } from 'penpal';

const connection = connect({
  messenger: new PortMessenger({ port: parentPort }),
  methods: {
    multiply(num1, num2) {
      return num1 * num2;
    },
    async divide(num1, num2) {
      return num1 / num2;
    },
    async addInParent(num1, num2) {
      const remote = await connection.promise;
      return remote.add(num1, num2);
    },
  },
});
