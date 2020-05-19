// import _connectToChild from './parent/connectToChild';
// import _connectToParent from './child/connectToParent';
// import { ErrorCode as _ErrorCode } from './enums';

//export const connectToChild = _connectToChild;
//export const connectToParent = _connectToParent;
//export const ErrorCode = _ErrorCode;

export { default as connectToChild } from './parent/connectToChild';
export { default as connectToParent } from './child/connectToParent';
export { ErrorCode } from './enums';