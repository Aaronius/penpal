import { PenpalError } from './types';

export type Destructor = {
  destroy(error?: PenpalError): void;
  onDestroy(callback: Function): void;
};

export default (): Destructor => {
  const callbacks: Function[] = [];
  let destroyed = false;

  return {
    destroy(error) {
      destroyed = true;
      callbacks.forEach(callback => {
        callback(error);
      });
    },
    onDestroy(callback) {
      destroyed ? callback() : callbacks.push(callback);
    }
  };
};
