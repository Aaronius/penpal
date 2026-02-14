import {
  createIframeAndConnection,
  createPortAndConnection,
  createWorkerAndConnection,
} from './utils.js';
import { runCommunicationContract } from './contracts/communicationContract.js';
import { runMethodCallLifecycleContract } from './contracts/methodCallLifecycleContract.js';

const variants = [
  {
    childType: 'iframe',
    createConnection: createIframeAndConnection,
  },
  {
    childType: 'worker',
    createConnection: createWorkerAndConnection,
  },
  {
    childType: 'port',
    createConnection: createPortAndConnection,
  },
];

for (const variant of variants) {
  const { childType, createConnection } = variant;

  runCommunicationContract({
    suiteName: `communication between parent and child ${childType}`,
    createConnection,
    includeAdvancedCases: true,
  });

  runMethodCallLifecycleContract({
    suiteName: `method call lifecycle between parent and child ${childType}`,
    createConnection,
  });
}
