import { ContextType } from '../enums';

// Indication of whether we're running in a worker or an iframe.
const contextType =
  typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope
    ? ContextType.Worker
    : ContextType.Window;

export default contextType;
