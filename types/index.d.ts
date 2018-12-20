// TypeScript Version: 3.0

/**
 * Given a type of object with methods, make some (or all) of the return values
 * "async" (i.e., returning a @pre{string} becomes returning a @pre{Promise<string>}).
 *
 * All non-function properties are excluded from the resultant type
 *
 * @example
 * ```ts
 *
 * interface User {
 *   isAdmin: boolean; // will not be included
 *   login(): boolean;
 *   resetPassword(): string;
 *   sendEmail(body: string): boolean;
 * }
 * const x: AsyncMethodReturns<User> ...;  # {
 *                                         #   login(): Promise<boolean>,
 *                                         #   resetPassword(): Promise<string>
 *                                         #   sendEmail(body: string): Promise<boolean>;
 *                                         # }
 * ```
 *
 */
export type AsyncMethodReturns<T, K extends keyof T = keyof T> = {
  [KK in K]: T[KK] extends (...args: any[]) => PromiseLike<any>
    ? T[KK]
    : T[KK] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<R>
    : T[KK]
};

export interface IConnectionObject<Methods extends ConnectionMethods> {
  promise: Promise<AsyncMethodReturns<Methods>>;
  destroy: () => {};
}

export interface IChildConnectionObject<Methods extends ConnectionMethods>
  extends IConnectionObject<Methods> {
  iframe: HTMLIFrameElement;
}

export type ConnectionMethods<T = {}> = { [P in keyof T]: () => Promise<any> };

type ERR_CONNECTION_DESTROYED = 'ConnectionDestroyed';
type ERR_CONNECTION_TIMEOUT = 'ConnectionTimeout';
type ERR_NOT_IN_IFRAME = 'NotInIframe';

export interface IConnectionOptions {
  methods?: ConnectionMethods;
  timeout?: number;
}

export interface IChildConnectionOptions extends IConnectionOptions {
  url: string;
  appendTo?: HTMLElement;
}

export interface IParentConnectionOptions extends IConnectionOptions {
  parentOrigin?: string;
}

export interface PenpalStatic {
  connectToChild<Methods extends ConnectionMethods = any>(
    options: IChildConnectionOptions
  ): // tslint:disable-next-line: no-unnecessary-generics
  IChildConnectionObject<Methods>;
  connectToParent<Methods extends ConnectionMethods = any>(
    options?: IParentConnectionOptions
  ): // tslint:disable-next-line: no-unnecessary-generics
  IConnectionObject<Methods>;
  Promise: typeof Promise;
  debug: boolean;
  ERR_CONNECTION_DESTROYED: ERR_CONNECTION_DESTROYED;
  ERR_CONNECTION_TIMEOUT: ERR_CONNECTION_TIMEOUT;
  ERR_NOT_IN_IFRAME: ERR_NOT_IN_IFRAME;
}

declare const Penpal: PenpalStatic;
export default Penpal;
export const ERR_CONNECTION_DESTROYED: ERR_CONNECTION_DESTROYED;
export const ERR_CONNECTION_TIMEOUT: ERR_CONNECTION_TIMEOUT;
export const ERR_NOT_IN_IFRAME: ERR_NOT_IN_IFRAME;
