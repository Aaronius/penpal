import { Destructor, DestructorCallback, Log, PenpalError } from './types';

export default (log: Log): Destructor => {
  const callbacks: DestructorCallback[] = [];
  let destroyed = false;

  return {
    destroy(error?: PenpalError) {
      if (!destroyed) {
        destroyed = true;
        log(`Destroying connection`);
        callbacks.forEach((callback) => {
          callback(error);
        });
      }
    },
    onDestroy(callback) {
      if (destroyed) {
        callback();
      } else {
        callbacks.push(callback);
      }
    },
  };
};
