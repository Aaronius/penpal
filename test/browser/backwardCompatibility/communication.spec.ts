import type { Methods } from '../../../src/index.js';
import FixtureMethods from '../fixtures/types/FixtureMethods.js';
import { runCommunicationContract } from '../contracts/communicationContract.js';
import { runMethodCallLifecycleContract } from '../contracts/methodCallLifecycleContract.js';
import { createBackwardCompatibilityIframeAndConnection } from './utils.js';

const createConnection = (options?: { methods?: Methods }) => {
  return createBackwardCompatibilityIframeAndConnection<FixtureMethods>({
    methods: options?.methods,
  }).connection;
};

runCommunicationContract({
  suiteName:
    'BACKWARD COMPATIBILITY: communication between parent and child iframe',
  createConnection,
  includeAdvancedCases: false,
});

runMethodCallLifecycleContract({
  suiteName:
    'BACKWARD COMPATIBILITY: method call lifecycle between parent and child iframe',
  createConnection,
});
