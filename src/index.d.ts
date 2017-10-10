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
    }

    interface IChildConnectionOptions extends IConnectionOptions {
        appendTo?: HTMLElement;
        url: string;
    }

    interface IParentConnectionOptions extends IConnectionOptions {
        parentOrigin?: string[] | string;
    }

    interface PenpalStatic {
        connectToChild(options: IChildConnectionOptions): IChildConnectionObject;
        connectToParent(options?: IParentConnectionOptions): IConnectionObject;
        Promise: typeof Promise;
        debug: Boolean;
    }
}

declare module 'penpal' {
    const Penpal: Penpal.PenpalStatic;
    export = Penpal;
}
