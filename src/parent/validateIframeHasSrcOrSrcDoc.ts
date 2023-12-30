import { PenpalError } from '../types';
import { ErrorCode } from '../enums';

export default (iframe: HTMLIFrameElement) => {
  if (!iframe.src && !iframe.srcdoc) {
    const error: PenpalError = new Error(
      'The childOrigin option must be specified or the iframe must have src or srcdoc property defined'
    ) as PenpalError;
    error.code = ErrorCode.OriginRequired;
    throw error;
  }
};
