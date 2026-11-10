<div align="center">

<img alt="Penpal Logo" src=".github/assets/readme-banner.svg">

</div>

<p align="center">
  Penpal simplifies communication with iframes, workers, and windows by
  <br/>
  using promise-based methods on top of postMessage.
  <br/>
</p>

<div align="center">

[![npm version](https://badge.fury.io/js/penpal.svg)](https://badge.fury.io/js/penpal)

</div>

Migration instructions for each major release can be found on the corresponding GitHub release tag.

## Installation

### Using npm

Install Penpal from npm as follows:

`npm install penpal`

### Using a CDN

Alternatively, load a build of Penpal that is already hosted on a CDN:

`<script src="https://unpkg.com/penpal@^8/dist/penpal.min.js"></script>`

Penpal will then be installed on `window.Penpal`. Usage is similar to if you were using it from npm, which is documented below, but instead of importing each module, you would access it on the `Penpal` global variable instead.

## Usage with an Iframe

<details>
    <summary>Expand Details</summary>

### Parent Window

```javascript
import { WindowMessenger, connect } from 'penpal';

const iframe = document.createElement('iframe');
iframe.src = 'https://childorigin.example.com/path/to/iframe.html';
document.body.appendChild(iframe);

const messenger = new WindowMessenger({
  remoteWindow: iframe.contentWindow,
  // Defaults to the current origin.
  allowedOrigins: ['https://childorigin.example.com'],
  // Alternatively,
  // allowedOrigins: [new URL(iframe.src).origin]
});

const connection = connect({
  messenger,
  // Methods the parent window is exposing to the iframe window.
  methods: {
    add(num1, num2) {
      return num1 + num2;
    },
  },
});

const remote = await connection.promise;
// Calling a remote method will always return a promise.
const multiplicationResult = await remote.multiply(2, 6);
console.log(multiplicationResult); // 12
const divisionResult = await remote.divide(12, 4);
console.log(divisionResult); // 3
```

### Iframe Window

```javascript
import { WindowMessenger, connect } from 'penpal';

const messenger = new WindowMessenger({
  remoteWindow: window.parent,
  // Defaults to the current origin.
  allowedOrigins: ['https://parentorigin.example.com'],
});

const connection = connect({
  messenger,
  // Methods the iframe window is exposing to the parent window.
  methods: {
    multiply(num1, num2) {
      return num1 * num2;
    },
    divide(num1, num2) {
      // Return a promise if asynchronous processing is needed.
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(num1 / num2);
        }, 1000);
      });
    },
  },
});

const remote = await connection.promise;
// Calling a remote method will always return a promise.
const additionResult = await remote.add(2, 6);
console.log(additionResult); // 8
```

</details>

## Usage with an Opened Window

<details>
    <summary>Expand Details</summary>

### Parent Window

```javascript
import { WindowMessenger, connect } from 'penpal';

const windowUrl = 'https://childorigin.example.com/path/to/window.html';
const childWindow = window.open(windowUrl);

const messenger = new WindowMessenger({
  remoteWindow: childWindow,
  // Defaults to the current origin.
  allowedOrigins: ['https://childorigin.example.com'],
  // Alternatively,
  // allowedOrigins: [new URL(windowUrl).origin]
});

const connection = connect({
  messenger,
  // Methods the parent window is exposing to the child window.
  methods: {
    add(num1, num2) {
      return num1 + num2;
    },
  },
});

const remote = await connection.promise;
// Calling a remote method will always return a promise.
const multiplicationResult = await remote.multiply(2, 6);
console.log(multiplicationResult); // 12
const divisionResult = await remote.divide(12, 4);
console.log(divisionResult); // 3
```

### Opened Window

```javascript
import { WindowMessenger, connect } from 'penpal';

const messenger = new WindowMessenger({
  remoteWindow: window.opener,
  // Defaults to the current origin.
  allowedOrigins: ['https://parentorigin.example.com'],
});

const connection = connect({
  messenger,
  // Methods the child window is exposing to the parent (opener) window.
  methods: {
    multiply(num1, num2) {
      return num1 * num2;
    },
    divide(num1, num2) {
      // Return a promise if asynchronous processing is needed.
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(num1 / num2);
        }, 1000);
      });
    },
  },
});

const remote = await connection.promise;
// Calling a remote method will always return a promise.
const additionResult = await remote.add(2, 6);
console.log(additionResult); // 8
```

</details>

## Usage with a Web Worker

<details>
    <summary>Expand Details</summary>

### Window

```javascript
import { WebWorkerMessenger, connect } from 'penpal';

const worker = new Worker('worker.js');

const messenger = new WebWorkerMessenger({
  worker,
});

const connection = connect({
  messenger,
  // Methods the window is exposing to the worker.
  methods: {
    add(num1, num2) {
      return num1 + num2;
    },
  },
});

const remote = await connection.promise;
// Calling a remote method will always return a promise.
const multiplicationResult = await remote.multiply(2, 6);
console.log(multiplicationResult); // 12
const divisionResult = await remote.divide(12, 4);
console.log(divisionResult); // 3
```

### Worker

```javascript
import { WebWorkerMessenger, connect } from 'penpal';

const messenger = new WebWorkerMessenger({
  worker: self,
});

const connection = connect({
  messenger,
  // Methods the worker is exposing to the window.
  methods: {
    multiply(num1, num2) {
      return num1 * num2;
    },
    divide(num1, num2) {
      // Return a promise if asynchronous processing is needed.
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(num1 / num2);
        }, 1000);
      });
    },
  },
});

const remote = await connection.promise;
// Calling a remote method will always return a promise.
const additionResult = await remote.add(2, 6);
console.log(additionResult); // 8
```

</details>

## Usage with a Node.js Worker

<details>
    <summary>Expand Details</summary>

### Parent Thread (`parent.js`)

```javascript
import { Worker } from 'node:worker_threads';
import { NodeWorkerMessenger, connect } from 'penpal';

const worker = new Worker(new URL('./worker.js', import.meta.url));
const connection = connect({
  messenger: new NodeWorkerMessenger({ worker }),
  methods: {
    add(num1, num2) {
      return num1 + num2;
    },
  },
});

try {
  const remote = await connection.promise;
  console.log(await remote.multiply(2, 6)); // 12
  console.log(await remote.divide(12, 4)); // 3
  console.log(await remote.addInParent(2, 6)); // 8
} finally {
  connection.destroy();
  await worker.terminate();
}
```

### Worker Thread (`worker.js`)

```javascript
import { parentPort } from 'node:worker_threads';
import { PortMessenger, connect } from 'penpal';

const connection = connect({
  messenger: new PortMessenger({ port: parentPort }),
  methods: {
    multiply(num1, num2) {
      return num1 * num2;
    },
    async divide(num1, num2) {
      return num1 / num2;
    },
    async addInParent(num1, num2) {
      const remote = await connection.promise;
      return remote.add(num1, num2);
    },
  },
});
```

</details>

## Usage with an AudioWorklet

<details>
    <summary>Expand Details</summary>

Use `PortMessenger` with `AudioWorkletNode.port` in the window and `this.port` in the processor. Run the window code from a user action such as a click on a secure page.

### Window

```javascript
import { PortMessenger, connect } from 'penpal';

const context = new AudioContext();
let connection;

try {
  await context.resume();
  await context.audioWorklet.addModule('/processor.js');
  const node = new AudioWorkletNode(context, 'processor-info');
  node.connect(context.destination);

  connection = connect({
    messenger: new PortMessenger({ port: node.port }),
    timeout: 5000,
  });

  const processor = await connection.promise;
  console.log(await processor.getSampleRate());
} finally {
  connection?.destroy();
  await context.close();
}
```

### Processor (`processor.js`)

Serve Penpal's ES module at `/penpal.mjs` for this example, or bundle Penpal into the processor module.

```javascript
import { PortMessenger, connect } from '/penpal.mjs';

class InfoProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    connect({
      messenger: new PortMessenger({ port: this.port }),
      methods: {
        getSampleRate() {
          return sampleRate;
        },
      },
    });
  }

  process() {
    return true;
  }
}

registerProcessor('processor-info', InfoProcessor);
```

Set connection and method call timeouts on the window side. AudioWorklet processors lack timers, so timeout requests from the processor reject with `INVALID_ARGUMENT`.

</details>

## Usage with a Shared Worker

<details>
    <summary>Expand Details</summary>

### Window

```javascript
import { PortMessenger, connect } from 'penpal';

const worker = new SharedWorker('shared-worker.js');

const messenger = new PortMessenger({
  port: worker.port,
});

const connection = connect({
  messenger,
  // Methods the window is exposing to the worker.
  methods: {
    add(num1, num2) {
      return num1 + num2;
    },
  },
});

const remote = await connection.promise;
// Calling a remote method will always return a promise.
const multiplicationResult = await remote.multiply(2, 6);
console.log(multiplicationResult); // 12
const divisionResult = await remote.divide(12, 4);
console.log(divisionResult); // 3
```

### Shared Worker

```javascript
import { PortMessenger, connect } from 'penpal';

self.addEventListener('connect', async (event) => {
  const [port] = event.ports;

  const messenger = new PortMessenger({
    port,
  });

  const connection = connect({
    messenger,
    // Methods the worker is exposing to the window.
    methods: {
      multiply(num1, num2) {
        return num1 * num2;
      },
      divide(num1, num2) {
        // Return a promise if asynchronous processing is needed.
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(num1 / num2);
          }, 1000);
        });
      },
    },
  });

  const remote = await connection.promise;
  // Calling a remote method will always return a promise.
  const additionResult = await remote.add(2, 6);
  console.log(additionResult); // 8
});
```

</details>

## Usage with a Service Worker

<details>
    <summary>Expand Details</summary>

### Window

```javascript
import { PortMessenger, connect } from 'penpal';

const initPenpal = async () => {
  const { port1, port2 } = new MessageChannel();

  navigator.serviceWorker.controller?.postMessage(
    {
      type: 'INIT_PENPAL',
      port: port2,
    },
    {
      transfer: [port2],
    },
  );

  const messenger = new PortMessenger({
    port: port1,
  });

  const connection = connect({
    messenger,
    // Methods the window is exposing to the worker.
    methods: {
      add(num1, num2) {
        return num1 + num2;
      },
    },
  });

  const remote = await connection.promise;
  // Calling a remote method will always return a promise.
  const multiplicationResult = await remote.multiply(2, 6);
  console.log(multiplicationResult); // 12
  const divisionResult = await remote.divide(12, 4);
  console.log(divisionResult); // 3
};

if (navigator.serviceWorker.controller) {
  initPenpal();
}

navigator.serviceWorker.addEventListener('controllerchange', initPenpal);
navigator.serviceWorker.register('service-worker.js');
```

### Service Worker

```javascript
import { PortMessenger, connect } from 'penpal';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
self.addEventListener('message', async (event) => {
  if (event.data?.type !== 'INIT_PENPAL') {
    return;
  }

  const { port } = event.data;

  const messenger = new PortMessenger({
    port,
  });

  const connection = connect({
    messenger,
    // Methods worker is exposing to window.
    methods: {
      multiply(num1, num2) {
        return num1 * num2;
      },
      divide(num1, num2) {
        // Return a promise if asynchronous processing is needed.
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(num1 / num2);
          }, 1000);
        });
      },
    },
  });

  const remote = await connection.promise;
  // Calling a remote method will always return a promise.
  const additionResult = await remote.add(2, 6);
  console.log(additionResult); // 8
});
```

</details>

## Running Examples

View the [running examples](https://aaronius.github.io/penpal/) online.

The [`examples`](./examples) directory contains running examples for each
supported communication target:

- [iframe](./examples/src/iframe)
- [opened window](./examples/src/opened-window)
- [dedicated worker](./examples/src/worker)
- [shared worker](./examples/src/shared-worker)
- [service worker](./examples/src/service-worker)
- [AudioWorklet](./examples/src/audio-worklet)

To run the examples locally, build Penpal and the examples, then start the
example server:

```sh
npm install
npm run examples:dev
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173) and select an example.

## Destroying the Connection

At any point in time, call `connection.destroy()` to destroy the connection so that event listeners can be removed and objects can be properly garbage collected. If the connection is destroyed before it has been established, the promise found at `connection.promise` will be rejected with a `CONNECTION_DESTROYED` error.

```javascript
import { connect, ErrorCode } from 'penpal';

const connection = connect({
  messenger,
});

connection.destroy();

try {
  await connection.promise;
} catch (error) {
  if (error.code === ErrorCode.ConnectionDestroyed) {
    // Connection failed because it was destroyed.
  }
}
```

## Debugging

To debug while using Penpal, specify a function for the `log` option when calling `connect()`. This function will be called whenever Penpal needs to log a message. While this can be any function, Penpal exports a simple logging function called `debug` which you can import and use. Passing a prefix into `debug` will help to distinguish the origin of log messages.

```javascript
import { connect, debug } from 'penpal';

...

const connection = connect({
  messenger,
  log: debug('parent')
});
```

For more advanced logging, check out the popular [debug](https://www.npmjs.com/package/debug) package which can be used similarly.

```javascript
import debug from 'debug';
import { connect } from 'penpal';

...

const connection = connect({
  messenger,
  log: debug('penpal:parent')
});
```

## Timeouts

### Connection Timeouts

When establishing a connection, you may specify a timeout in milliseconds. If a connection is not successfully made within the timeout period, the connection promise will be rejected with an error. See [Errors](#errors) for more information on errors.

```javascript
import { ErrorCode } from 'penpal';

...

const connection = connect({
  messenger,
  timeout: 5000 // 5 seconds
});

try {
  const remote = await connection.promise;
} catch (error) {
  if (error.code === ErrorCode.ConnectionTimeout) {
    // Connection failed due to timeout.
  }
}
```

### Method Call Timeouts

When calling a remote method, you may specify a timeout in milliseconds by passing an instance of `CallOptions` as the last argument. If a response is not received within the timeout period, the method call promise will be rejected with an error. See [Errors](#errors) for more information on errors.

```javascript
import { CallOptions, ErrorCode } from 'penpal';

...

const remote = await connection.promise;

try {
  const multiplicationResult =
    await remote.multiply(2, 6, new CallOptions({ timeout: 1000 }));
} catch (error) {
  if (error.code === ErrorCode.MethodCallTimeout) {
    // Method call failed due to timeout.
  }
}
```

## Transferring Large Data

When sending a value between windows or workers, the browser uses a [structured clone algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm) by default to _clone_ the value as it is sent. As a result, the value will exist in memory multiple times--once for the sender and once for the recipient. This is typically fine, but some use cases require sending a large amount of data between contexts which could result in a significant performance hit.

To address this scenario, browsers support [transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects) which allow certain types of objects to be _transferred_ between contexts. Rather than cloning the object, the browser will provide the receiving context a pointer to the object's existing block of memory.

When calling a remote method using Penpal, you may specify which objects should be transferred rather than cloned by passing an instance of `CallOptions` as the last argument with the `transferables` option set. When responding to a method call, you may specify which objects should be transferred by returning an instance of `Reply` with the `transferables` option set.

### Window

```javascript
import { connect, CallOptions } from 'penpal';

...

const connection = connect({
  messenger
});

const remote = await connection.promise;

const numbersArray = new Int32Array(new ArrayBuffer(8));
numbersArray[0] = 4;
numbersArray[1] = 5;

const multiplicationResultArray = await remote.double(
  numbersArray,
  new CallOptions({ transferables: [numbersArray.buffer] })
);

console.log(multiplicationResultArray[0]); // 8
console.log(multiplicationResultArray[1]); // 10
```

### Worker

```javascript
import { connect, Reply } from 'penpal';

...

const connection = connect({
  messenger,
  methods: {
    double(numbersArray) {
      // numbersArray and resultArray are both Int32Arrays
      const resultArray = numbersArray.map(num => num * 2);
      return new Reply(resultArray, {
        transferables: [resultArray.buffer],
      });
    }
  },
});
```

## Parallel Connections

In fairly rare cases, you may wish to make parallel connections between two participants. To illustrate, let's use a scenario where you wish to make two parallel connections between a parent window and an iframe window. In other words, you will be calling `connect()` twice within the parent window and twice within the iframe window.

In an attempt to establish these two connections, Penpal in the parent window will be calling `postMessage()` on the iframe's window object (`iframe.contentWindow`). By default, when Penpal within the iframe window receives these messages, it has no way to disambiguate messages related to the parent window's first call to `connect()` from messages related to the parent window's second call to `connect()`. As a result, the connections may fail to be properly established.

To prevent this issue, Penpal provides the concept of channels. A channel is a string identifier of your choosing that you may provide when calling `connect()` within both participants. When a channel is provided, it is used to disambiguate communication between parallel connections. This is better explained in code:

### Parent Window

```javascript
import { WindowMessenger, connect } from 'penpal';

const iframe = document.createElement('iframe');
iframe.src = 'https://childorigin.example.com/iframe.html';
document.body.appendChild(iframe);

const messengerA = new WindowMessenger({
  remoteWindow: iframe.contentWindow,
  allowedOrigins: ['https://childorigin.example.com'],
});

const connectionA = connect({
  messenger: messengerA,
  channel: 'A',
  methods: {
    add(num1, num2) {
      return num1 + num2;
    },
  },
});

// Note that each call to connect() needs a separate messenger instance.
const messengerB = new WindowMessenger({
  remoteWindow: iframe.contentWindow,
  allowedOrigins: ['https://childorigin.example.com'],
});

const connectionB = connect({
  messenger: messengerB,
  channel: 'B',
  methods: {
    subtract(num1, num2) {
      return num1 - num2;
    },
  },
});
```

### Iframe Window

```javascript
import { WindowMessenger, connect } from 'penpal';

const messengerA = new WindowMessenger({
  remoteWindow: window.parent,
  allowedOrigins: ['https://parentorigin.example.com'],
});

const connectionA = connect({
  messenger: messengerA,
  channel: 'A',
  methods: {
    multiply(num1, num2) {
      return num1 * num2;
    },
  },
});

// Note that each call to connect() needs a separate messenger instance.
const messengerB = new WindowMessenger({
  remoteWindow: iframe.contentWindow,
  allowedOrigins: ['https://parentorigin.example.com'],
});

const connectionB = connect({
  messenger: messengerB,
  channel: 'B',
  methods: {
    divide(num1, num2) {
      return num1 / num2;
    },
  },
});
```

Although we're using `WindowMessenger` here to connect between a parent window and an iframe window, channels would similarly need to be used when using `WebWorkerMessenger` or `NodeWorkerMessenger` to make parallel connections to a worker. When using `PortMessenger`, channels are only needed when establishing parallel connections over a single pair of ports.

## Errors

Penpal will throw or reject promises with errors in certain situations. Each error will be an instance of `PenpalError` and will have a `code` property which may be used for programmatic decisioning (e.g., take a specific action if a method call times out) along with a `message` describing the problem. Changes to error codes will be considered breaking changes and require a new major version of Penpal to be released. Changes to messages will not be considered breaking changes. The following error codes are used:

`CONNECTION_DESTROYED`

This error will be thrown when attempting to call a method and the connection was previously destroyed. The promise found at `connection.promise` will also be rejected with this error if the connection is destroyed before it has been established.

`CONNECTION_TIMEOUT`

The promise found at `connection.promise` will be rejected with this error after the configured [connection timeout](#connection-timeouts) duration has elapsed and a connection has not been established.

`INVALID_ARGUMENT`

This error will be thrown when an invalid argument is passed to Penpal.

`METHOD_CALL_TIMEOUT`

The promise returned from a method call will be rejected with this error after the configured [method call timeout](#method-call-timeouts) duration has elapsed and a response has not been received.

`METHOD_NOT_FOUND`

The promise returned from a method call will be rejected with this error if the method does not exist on the remote.

`TRANSMISSION_FAILED`

When a connection is being established, the promise found at `connection.promise` will be rejected with this error if a message cannot be transmitted. When a method call is being made, the promise returned from the method call will be rejected with this error if a message cannot be transmitted.

### Referencing Error Codes

For your convenience, the above error codes can be imported and referenced as follows:

```
import { ErrorCode } from 'penpal';
// ErrorCode.ConnectionDestroyed
// ErrorCode.ConnectionTimeout
// ErrorCode.InvalidArgument
// ErrorCode.MethodCallTimeout
// ErrorCode.MethodNotFound
// ErrorCode.TransmissionFailed
```

## TypeScript

Penpal is built in TypeScript and provides full TypeScript support. When calling `connect()`, we recommend passing an interface or type alias as a type argument to describe the methods the remote exposes. Penpal uses this type for the `remote` object that `connection.promise` resolves to.

If you omit the type argument, you can still call remote methods by name, but each call returns `Promise<unknown>`. Here's an example with a type argument.

### Window Connecting to a Worker

```typescript
import { WebWorkerMessenger, connect } from 'penpal';

// This interface could be in a module imported by both the window and worker.
interface WorkerMethods {
  multiply(...args: number[]): number;
}

const worker = new Worker('worker.js');

const messenger = new WebWorkerMessenger({
  worker,
});

const connection = connect<WorkerMethods>({
  messenger,
});

// This `remote` object will contain properly typed methods.
const remote = await connection.promise;
// This `multiplicationResult` constant will be properly typed as a number.
const multiplicationResult = await remote.multiply(2, 6);
```

```typescript
const methods: WorkerMethods = {
  multiply(...args) {
    return args.reduce((product, value) => product * value, 1);
  },
};

connect({ messenger: new WebWorkerMessenger({ worker: self }), methods });
```

When creating a worker, it's highly recommended that you add the following line of code at the top of your worker script depending on which type of worker you're creating:

- Dedicated (regular) worker: `declare const self: DedicatedWorkerGlobalScope;`
- Shared worker: `declare const self: SharedWorkerGlobalScope;`
- Service worker: `declare const self: ServiceWorkerGlobalScope;`

This lets TypeScript know which type of worker you're creating, and you'll run into fewer TypeScript errors.

### Exported Types

Penpal exports several types for your usage. Import types as follows:

```typescript
import type { Connection, MethodsShape, RemoteProxy } from 'penpal';
```

The types are described as follows:

#### `Connection`

`connect<TRemoteMethods>()` returns a `Connection<TRemoteMethods>`. Its `promise` resolves to a `RemoteProxy<TRemoteMethods>`.

#### `MethodsShape<T>`

The constraint Penpal uses to check that the type passed to `connect<T>()` describes only methods and nested groups of methods. Use it when writing a generic wrapper around `connect`:

```typescript
import { connect, type Messenger, type MethodsShape } from 'penpal';

function connectToWorker<TRemoteMethods extends MethodsShape<TRemoteMethods>>(
  messenger: Messenger,
) {
  return connect<TRemoteMethods>({ messenger });
}
```

#### `RemoteProxy`

The object that `connection.promise` resolves to is a `RemoteProxy<TRemoteMethods>`, where `TRemoteMethods` is the type you pass as a type argument when calling `connect<TRemoteMethods>()`, as described above. You can call the methods declared in `TRemoteMethods` on that proxy, and each call returns a promise.

```typescript
import type { RemoteProxy } from 'penpal';

async function logProduct(workerMethods: RemoteProxy<YourRemoteMethods>) {
  console.log(await workerMethods.multiply(2, 6));
}

await logProduct(remote);
```

`RemoteProxy` without a type argument allows any method name and returns `Promise<unknown>` from each call.

## React

If you're using Penpal within a React app, please check out [@weblivion/react-penpal](https://www.npmjs.com/package/@weblivion/react-penpal).

## Supported Browsers

Penpal is designed to run successfully on the most recent versions of Chrome, Firefox, Safari, and Edge. Penpal has also been reported to work within Ionic projects on iOS and Android devices.

## API

### `connect(options: Object) => Object`

#### Options

`messenger: Messenger` (required)

A messenger instance. Messengers handle the technical details of transmitting messages. The current available messengers are `WindowMessenger`, `WebWorkerMessenger`, `NodeWorkerMessenger`, and `PortMessenger`, though any object that complies with the Messenger interface may be used. `WorkerMessenger` is an alias for `WebWorkerMessenger` for backward compatibility. Details related to building custom messengers are forthcoming.

`methods: object` (optional)

An object containing methods for the remote to call. The keys are method names and the values are functions. You can also group methods in nested objects. If a method needs to do asynchronous work, return a promise that resolves when the result is ready.

`timeout: number` (optional)

The amount of time, in milliseconds, Penpal should wait for a connection to be established before rejecting the connection promise. There is no timeout by default. See [Connection Timeouts](#connection-timeouts) for more information.

`channel: string` (optional)

A string identifier that disambiguates communication when establishing parallel connections between two participants (e.g., two windows, a window and a worker). See [Parallel Connections](#parallel-connections) for more information.

`log: (...args: unknown[]) => void` (optional)

Penpal will call the log function each time debugging information is available. Debug messages will only be logged when this is defined. See [Debugging](#debugging) for more information.

#### Return value

The return value of `connect` is a `Connection` object with the following properties:

`promise: Promise`

A promise which will be resolved once communication has been established. The promise will be resolved with an object that serves as a proxy for the methods the remote has exposed. Calling a method on this proxy object will always return a promise since it involves sending messages to and from the remote which are asynchronous operations. When calling a method on this proxy object, you may always pass an instance of `CallOptions` as a final argument. See [Method Call Timeouts](#method-call-timeouts) and [Transferring Large Data](#transferring-large-data) for more information on `CallOptions`.

`destroy: () => void`

A method that, when called, will disconnect any messaging channels, event listeners, etc. You may call this even before a connection has been established. If called before a connection has been established, the promise found at `connection.promise` will be rejected with a `CONNECTION_DESTROYED` error. See [Destroying the Connection](#destroying-the-connection) for more information.

---

### `WindowMessenger`

This messenger supports communication between two windows. See [Usage with an Iframe](#usage-with-an-iframe) and [Usage with an Opened Window](#usage-with-an-opened-window) for examples.

#### Constructor Options

`remoteWindow: Window`

A reference to the remote window exposing methods to the current (local) window. When connecting between a parent window and a child iframe window, in the parent you would specify the iframe's content window (`iframe.contentWindow`) while in the child you would specify the parent window (`window.parent`). When connecting between a parent window and a "child" window opened using `window.open()`, in the parent would specify the opened window while in the child you would specify the parent (opener) window (`window.opener`).

`allowedOrigins: (string | RegExp)[]` (optional)

An array of allowed origins with which the window is allowed to communicate. By default, Penpal will restrict communication to the origin of the current HTML document.

In some [scenarios](https://github.com/Aaronius/penpal/issues/73), you may want the window to communicate with any origin. In this case, you can specify `*` as an allowed origin. **This is discouraged as it means any website could potentially send or receive method calls.** When using the `file://` protocol or data URIs when loading HTML documents, you will likely need to specify `*` as an allowed origin due to native browser security policies but, again, understand your risks in doing so.

Regardless of how you configure `allowedOrigins`, communication will always be restricted to the window with which you are connecting.

If an iframe or opened window reloads or navigates to another page that calls `connect()`, Penpal establishes a new message channel with that page. The new page must be from an allowed origin. Once it reconnects, you can keep using the same remote proxy. Calls still waiting for a reply from the previous page reject with `TRANSMISSION_FAILED`.

---

### `WebWorkerMessenger`

This messenger supports communication with a [Web Worker](https://developer.mozilla.org/en-US/docs/Web/API/Worker) (also known as a dedicated worker). See [Usage with a Web Worker](#usage-with-a-web-worker) for an example. This cannot be used for shared workers or service workers, which use the [PortMessenger](#portmessenger) instead.

`WorkerMessenger` is an alias for `WebWorkerMessenger` for backward compatibility. Both exports reference the same class.

#### Constructor Options

`worker: Worker | DedicatedWorkerGlobalScope`

A reference to the worker. When connecting from a window, you would specify the instantiated worker object. When connecting from the worker, you would specify `self`.

---

### `WorkerMessenger`

`WorkerMessenger` is an alias of [`WebWorkerMessenger`](#webworkermessenger) for backward compatibility and will be removed in a future major version.

---

### `NodeWorkerMessenger`

This messenger supports communication with a Node.js `Worker` from `node:worker_threads`. Inside the worker, use `PortMessenger` with `parentPort`. See [Usage with a Node.js Worker](#usage-with-a-nodejs-worker) for an example.

#### Constructor Options

`worker: Worker` (from `node:worker_threads`)

A reference to the Node.js worker. Penpal uses the worker's existing message channel to establish the connection and send method calls and replies. If the worker exits, Penpal closes the connection and rejects any pending handshake or method calls with `CONNECTION_DESTROYED`.

Calling `connection.destroy()` stops Penpal from listening to the worker. If you also want to stop the worker, call `worker.terminate()`.

---

### `PortMessenger`

This messenger supports communication between a pair of browser or Node.js [MessagePorts](https://developer.mozilla.org/en-US/docs/Web/API/MessagePort). See the [AudioWorklet](#usage-with-an-audioworklet), [Shared Worker](#usage-with-a-shared-worker), [Service Worker](#usage-with-a-service-worker), and [Node.js Worker](#usage-with-a-nodejs-worker) examples, including use of a Node.js worker's `parentPort`.

#### Constructor Options

`port: MessagePort`

A reference to the port. Each of the two participants in a Penpal connection will have its own [MessagePort](https://developer.mozilla.org/en-US/docs/Web/API/MessagePort).

Destroying a connection removes Penpal's listener and leaves the port open. The application can reuse the port or close it when it is finished with it.

---

## Documentation for Previous Versions

- [v7 documentation](https://github.com/Aaronius/penpal/tree/7.x)
- [v6 documentation](https://github.com/Aaronius/penpal/tree/6.x)
- [v5 documentation](https://github.com/Aaronius/penpal/tree/5.x)
- [v4 documentation](https://github.com/Aaronius/penpal/tree/4.x)
- [v3 documentation](https://github.com/Aaronius/penpal/tree/3.x)

## Inspiration

This library is inspired by:

- [Postmate](https://github.com/dollarshaveclub/postmate)
- [JSChannel](https://github.com/mozilla/jschannel)
- [post-me](https://github.com/alesgenova/post-me)
- [Comlink](https://github.com/GoogleChromeLabs/comlink)

## License

MIT

## Contributing

If you'd like to contribute or run the full local test/build workflows, see [CONTRIBUTING.md](./CONTRIBUTING.md).
