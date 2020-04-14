import { ErrorCode } from './enums';

// These exports were created before switching Penpal over to TypeScript.
// Had it been done after converting to TypeScript, the enum itself would
// be exported instead.
export const ERR_CONNECTION_DESTROYED = ErrorCode.ConnectionDestroyed;
export const ERR_CONNECTION_TIMEOUT = ErrorCode.ConnectionTimeout;
export const ERR_NOT_IN_IFRAME = ErrorCode.NotInIframe;
export const ERR_NO_IFRAME_SRC = ErrorCode.NoIframeSrc;
