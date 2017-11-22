declare namespace Penpal {

  interface IConnectionObject {
    promise: Promise<any>;
    destroy: () => {};
  }

  interface IChildConnectionObject extends IConnectionObject {
    iframe: HTMLElement;
  }

  type ConnectionMethods<T> = {
    [P in keyof T]: () => Promise<any>;
  };

  interface IConnectionOptions {
    methods?: ConnectionMethods<{}>;
    timeout?: number;
  }

  interface IChildConnectionOptions extends IConnectionOptions {
    url: string;
    appendTo?: HTMLElement;
  }

  interface IParentConnectionOptions extends IConnectionOptions {
    parentOrigin?: string;
  }

  interface PenpalStatic {
    connectToChild(options: IChildConnectionOptions): IChildConnectionObject;
    connectToParent(options?: IParentConnectionOptions): IConnectionObject;
    Promise: typeof Promise;
    debug: boolean;
    ERR_CONNECTION_DESTROYED: string;
    ERR_CONNECTION_TIMEOUT: string;
    ERR_NOT_IN_IFRAME: string;
  }
}

declare module 'penpal' {
  const Penpal: Penpal.PenpalStatic;
  export = Penpal;
  export var ERR_CONNECTION_DESTROYED: string;
  export var ERR_CONNECTION_Timeout: string;
  export var ERR_CONNECTION_DESTROYED: string;
}
