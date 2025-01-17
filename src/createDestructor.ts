import { Destructor, DestructorCallback, Log } from './types';
import PenpalError from './PenpalError';

export default (log: Log): Destructor => {
  const callbacks: DestructorCallback[] = [];
  let destroyed = false;

  return {
    destroy(error?: PenpalError) {
      if (!destroyed) {
        destroyed = true;
        log(`Closing connection`);
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
