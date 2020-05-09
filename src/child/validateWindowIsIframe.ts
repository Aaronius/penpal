import { PenpalError } from '../types';
import { ErrorCode } from '../enums';

export default () => {
  if (window === window.top) {
    const error = new Error(
      'connectToParent() must be called within an iframe'
    ) as PenpalError;
    error.code = ErrorCode.NotInIframe;
    throw error;
  }
}
