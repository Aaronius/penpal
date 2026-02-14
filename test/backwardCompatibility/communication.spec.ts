import type { Methods } from '../../src/index.js';
import FixtureMethods from '../childFixtures/types/FixtureMethods.js';
import { runCommunicationContract } from '../contracts/communicationContract.js';
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
