import { PenpalError } from './types';

export type Destructor = {
  /**
   * Calls all onDestroy callbacks.
   */
  destroy(error?: PenpalError): void;
  /**
   * Registers a callback to be called when destroy is called.
   */
  onDestroy(callback: Function): void;
};

export default (localName: 'Parent' | 'Child', log: Function): Destructor => {
  const callbacks: Function[] = [];
  let destroyed = false;

  return {
    destroy(error) {
      if (!destroyed) {
        destroyed = true;
        log(`${localName}: Destroying connection`);
        callbacks.forEach((callback) => {
          callback(error);
        });
      }
    },
    onDestroy(callback) {
      destroyed ? callback() : callbacks.push(callback);
    },
  };
};
