import PenpalError from './PenpalError';

export type DestructionDetails =
  | {
      isConsumerInitiated: false;
      error: PenpalError;
    }
  | {
      isConsumerInitiated: true;
    };

type DestructorCallback = (options: DestructionDetails) => void;

class Destructor {
  private _callbacks: DestructorCallback[] = [];
  private _destroyed = false;
  private _destructionDetails?: DestructionDetails;

  destroy = (options: DestructionDetails) => {
    if (!this._destroyed) {
      this._destroyed = true;
      this._destructionDetails = options;
      for (const callback of this._callbacks) {
        callback(options);
      }
      this._callbacks = [];
    }
  };

  onDestroy = (callback: DestructorCallback) => {
    if (this._destroyed) {
      if (!this._destructionDetails) {
        // If this occurs, it's a bug.
        throw new Error('Destruction details not saved');
      }
      callback(this._destructionDetails);
    } else {
      this._callbacks.push(callback);
    }
  };
}

export default Destructor;
