import { Worker } from 'node:worker_threads';
import { NodeWorkerMessenger, connect } from 'penpal';

const worker = new Worker(new URL('./worker.js', import.meta.url));
const connection = connect({
  messenger: new NodeWorkerMessenger({ worker }),
  timeout: 5000,
  methods: {
    add(num1, num2) {
      return num1 + num2;
    },
  },
});

try {
  const remote = await connection.promise;
  console.log(await remote.multiply(2, 6)); // 12
  console.log(await remote.divide(12, 4)); // 3
  console.log(await remote.addInParent(2, 6)); // 8
} finally {
  connection.destroy();
  await worker.terminate();
}
