[![npm version](https://badge.fury.io/js/penpal.svg)](https://badge.fury.io/js/penpal)

[See documentation for 6.x](https://github.com/Aaronius/penpal/tree/master)  
[See documentation for 5.x](https://github.com/Aaronius/penpal/tree/5.x)  
[See documentation for 4.x](https://github.com/Aaronius/penpal/tree/4.x)  
[See documentation for 3.x](https://github.com/Aaronius/penpal/tree/3.x)

# Penpal

Penpal makes communication between windows (including iframes) and workers simple by abstracting the details of postMessage into promise-based methods.

This library has no dependencies.

## Installation

### Using npm

Install Penpal from npm as follows:

`npm install penpal`

### Using a CDN

Alternatively, load a build of Penpal that is already hosted on a CDN:

`<script src="https://unpkg.com/penpal@^7/dist/penpal.min.js"></script>`

Penpal will then be installed on `window.Penpal`. Usage is similar to if you were using it from npm, which is documented below, but instead of importing each module, you would access it on the `Penpal` global variable instead.

## Usage with an Iframe

<details open>
    <summary>Expand Details</summary>

### Parent Window

```javascript
import { WindowMessenger, connect } from 'penpal';

const iframe = document.createElement('iframe');
iframe.src = 'https://childorigin.example.com/iframe.html';
document.body.appendChild(iframe);

const messenger = new WindowMessenger({
  remoteWindow: iframe.contentWindow,
  // allowedOrigins will default to `[window.origin]` if not specified
  allowedOrigins: ['https://childorigin.example.com'],
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
  // allowedOrigins will default to `[window.origin]` if not specified
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

## Usage with a Window Opened Using `window.open`

<details>
    <summary>Expand Details</summary>

### Parent Window

```javascript
import { WindowMessenger, connect } from 'penpal';

const childWindow = window.open('https://childorigin.example.com/popup.html');

const messenger = new WindowMessenger({
  remoteWindow: childWindow,
  // allowedOrigins will default to `[window.origin]` if not specified
  allowedOrigins: ['https://childorigin.example.com'],
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
  // allowedOrigins will default to `[window.origin]` if not specified
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
console.log(additionResult); //
```

</details>

## Usage with a Worker

<details>
    <summary>Expand Details</summary>

### Window

```javascript
import { WorkerMessenger, connect } from 'penpal';

const worker = new Worker('worker.js');

const messenger = new WorkerMessenger({
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
import { WorkerMessenger, connect } from 'penpal';

const messenger = new WorkerMessenger({
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

## Usage with a Shared Worker

<details>
    <summary>Expand Details</summary>

### Window

```javascript
import { WorkerMessenger, connect } from 'penpal';

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

  navigator.serviceWorker.controller?.postMessage(
    {
      type: 'INIT_PAYPAL',
      port: port2,
    },
    {
      transfer: [port2],
    }
  );
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
  if (event.data?.type === 'INIT_PENPAL') {
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

## Closing the Connection

At any point in time, call `connection.close()` to close the connection. If you're closing a window or worker that's part of a connection, be sure to close the connection as well so that objects can be properly garbage collected.

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

When calling a remote method, you may specify a timeout in milliseconds by passing an instance of `MethodCallOptions` as the last argument. If a response is not received within the timeout period, the method call promise will be rejected with an error. See [Errors](#errors) for more information on errors.

```javascript
import { MethodCallOptions, ErrorCode } from 'penpal';

...

const remote = await connection.promise;

try {
  const multiplicationResult =
    await remote.multiply(2, 6, new MethodCallOptions({ timeout: 1000 }));
} catch (error) {
  if (error.code === ErrorCode.MethodCallTimeout) {
    // Method call failed due to timeout.
  }
}
```

## Transferable Objects

When sending a value between windows or workers, the browser uses a [structured clone algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm) by default to _clone_ the value as it is sent. As a result, the value will exist in memory multiple times--once for the sender and once for the recipient. This is typically fine, but some use cases require sending a large amount of data between contexts which could result in a significant performance hit.

To address this scenario, browsers support [transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects) which allow certain types of objects to be _transferred_ between contexts. Rather than cloning the object, the browser will provide the receiving context a pointer to the object's existing block of memory.

When calling a remote method using Penpal, you may specify which objects should be transferred rather than cloned by passing an instance of `MethodCallOptions` as the last argument with the `transferables` option set. When responding to a method call, you may specify which objects should be transferred by returning an instance of `Reply` with the `transferables` option set.

### Window

```javascript
import { connect, MethodCallOptions } from 'penpal';

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
  new MethodCallOptions({ transferables: [numbersArray.buffer] })
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

## Multiple, Parallel Connections

In fairly rare cases, you may wish to make multiple, parallel connections between two participants. To illustrate, let's use a scenario where you wish to make two parallel connections between Window A and Window B. In other words, you will be calling `connect()` twice within Window A and twice within Window B.

In an attempt to establish these two connections, Penpal in Window A will be calling `postMessage()` on a single window object. By default, when Penpal within Window B receives these messages, it has no way to disambiguate messages related to the first call to `connect()` from messages related to the second call to `connect()`. As a result, the connections may fail to be properly established.

To prevent this issue, Penpal provides the concept of channels. A channel is a string identifier of your choosing that you may provide when calling `connect()` within both participants. When a channel is provided, it is used to disambiguate communication between multiple, parallel connections. This is better explained in code:

### Window A

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

### Window B

```javascript
import { WindowMessenger, connect } from 'penpal';

const messengerA = new WindowMessenger({
  remoteWindow: iframe.parent,
  allowedOrigins: ['https://parentOrigin.example.com'],
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

Although we're using `WindowMessenger` here to establish connections between two windows, channels would similarly need to be used when using `WorkerMessenger` to make multiple, parallel connections to a worker. When using `PortMessenger`, channels are only needed when establishing multiple, parallel connections over the same port (when using separate ports, messages are already disambiguated).

## Errors

Penpal will throw or reject promises with errors in certain situations. Each error will be an instance of `PenpalError` and will have a `code` property which may be used for programmatic decisioning (e.g., take a specific action if a method call times out) along with a `message` describing the problem. Changes to error codes will be considered breaking changes and require a new major version of Penpal to be released. Changes to messages will not be considered breaking changes. The following error codes are used:

`CONNECTION_CLOSED`

This error will be thrown when attempting to call a method and the connection was previously closed.

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

### Error Code Enumeration

For your convenience, the above error codes can be imported and referenced as follows:

```
import { ErrorCode } from 'penpal';
// ErrorCode.ConnectionClosed
// ErrorCode.ConnectionTimeout
// ErrorCode.InvalidArgument
// ErrorCode.MethodCallTimeout
// ErrorCode.MethodNotFound
// ErrorCode.TransmissionFailed
```

## TypeScript

Penpal is built in TypeScript and provides full TypeScript support. When calling `connect()`, it's recommended you pass a generic type argument that describes the methods the remote will be exposing. This will be used to type the `remote` object that `connection.promise` is resolved with. This is better explained in code:

### Window Connecting to a Worker

```typescript
import { WorkerMessenger, connect } from 'penpal';

// This interace could be in a module imported by both the window and worker.
interface WorkerApi {
  multiply(...args: number[]): number;
}

const worker = new Worker('worker.js');

const messenger = new WorkerMessenger({
  worker,
});

// Note we're passing in WorkerApi as a generic type argument.
const connection = connect<WorkerApi>({
  messenger,
});

// This `remote` object will contain properly typed methods.
const remote = await connection.promise;
// This `multiplicationResult` constant will be properly typed as a number.
const multiplicationResult = await remote.multiply(2, 6);
```

### Exported Types

Penpal exports several types for your usage. Import types as follows:

```typescript
import { Connection, Methods, RemoteProxy } from 'penpal';
```

The types are described as follows:

#### `Connection`

The connection object returned from `connect()` is typed as `Connection`.

#### `Methods`

The object you provide for the `methods` option when calling `connect()` must be compatible with the `Methods` type. The generic type argument you pass when calling `connect()` must also be compatible with the `Methods` type.

#### `RemoteProxy`

The object that `connection.promise` resolves to will be of type `RemoteProxy`. More specifically, it will be of type `RemoteProxy<TMethods>`, where `TMethods` is the type you pass as a generic type argument when calling `connect()` as described above.

## React

If you're using Penpal within a React app, please check out [@weblivion/react-penpal](https://www.npmjs.com/package/@weblivion/react-penpal).

## Supported Browsers

Penpal is designed to run successfully on the most recent versions of Chrome, Firefox, Safari, and Edge. Penpal has also been reported to work within Ionic projects on iOS and Android devices.

---

## API

### `connect(options: Object) => Object`

#### Options

`options.iframe: HTMLIFrameElement` (required)

The iframe element to which Penpal should connect. Unless you provide the `childOrigin` option, you will need to have set either the `src` or `srcdoc` property on the iframe prior to calling `connectToChild` so that Penpal can automatically derive the child origin. In addition to regular URLs, [data URIs](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs) and [file URIs](https://en.wikipedia.org/wiki/File_URI_scheme) are also supported.

`options.methods: Object` (optional)

An object containing methods which should be exposed for the child iframe to call. The keys of the object are the method names and the values are the functions. Nested objects with function values are recursively included. If a function requires asynchronous processing to determine its return value, make the function immediately return a promise and resolve the promise once the value has been determined.

`options.childOrigin: string` (optional)

In the vast majority of cases, Penpal can automatically determine the child origin based on the `src` or `srcdoc` property that you have set on the iframe. Communication will automatically be restricted to that origin.

In some rare cases, particularly when using the `file://` protocol on various devices, browsers are inconsistent in how they report and handle origins. If you receive an error saying that the parent received a handshake from an unexpected origin, you may need to manually pass the child origin using this option.

In other [niche scenarios](https://github.com/Aaronius/penpal/issues/73), you may want the parent to be able to communicate with any child origin. In this case, you can set `childOrigin` to `*`. **This is discouraged.** To illustrate the risk, if a nefarious attacker manages to create a link within the child page that another user can click (for example, if you fail to inadequately escape HTML in a message board comment), and that link navigates the unsuspecting user's iframe to a nefarious URL, then the page at the nefarious URL could start communicating with your parent window.

Regardless of how you configure `childOrigin`, communication will always be restricted to only the iframe to which you are connecting.

`options.timeout: number` (optional)

The amount of time, in milliseconds, Penpal should wait for the child to respond before rejecting the connection promise. There is no timeout by default.

`options.debug: boolean` (optional)

Enables or disables debug logging. Debug logging is disabled by default.

#### Return value

The return value of `connectToChild` is a `connection` object with the following properties:

`connection.promise: Promise`

A promise which will be resolved once communication has been established. The promise will be resolved with an object containing the methods which the child has exposed. Note that these aren't actual memory references to the methods the child exposed, but instead proxy methods Penpal has created with the same names and signatures. When one of these methods is called, Penpal will immediately return a promise and then go to work sending a message to the child, calling the actual method within the child with the arguments you have passed, and then sending the return value back to the parent. The promise you received will then be resolved with the return value.

`connection.destroy: Function`

A method that, when called, will disconnect any messaging channels. You may call this even before a connection has been established.

### `connectToParent([options: Object]) => Object`

#### Options

`options.parentOrigin: string | RegExp` (optional **but highly recommended!**)

The origin of the parent window which your iframe will be communicating with. If this is not provided, communication will not be restricted to any particular parent origin resulting in any webpage being able to load your webpage into an iframe and communicate with it.

`options.methods: Object` (optional)

An object containing methods which should be exposed for the parent window to call. The keys of the object are the method names and the values are the functions. Nested objects with function values are recursively included. If a function requires asynchronous processing to determine its return value, make the function immediately return a promise and resolve the promise once the value has been determined.

`options.timeout: number` (optional)

The amount of time, in milliseconds, Penpal should wait for the parent to respond before rejecting the connection promise. There is no timeout by default.

`options.debug: boolean` (optional)

Enables or disables debug logging. Debug logging is disabled by default.

#### Return value

The return value of `connectToParent` is a `connection` object with the following properties:

`connection.promise: Promise`

A promise which will be resolved once communication has been established. The promise will be resolved with an object containing the methods which the parent has exposed. Note that these aren't actual memory references to the methods the parent exposed, but instead proxy methods Penpal has created with the same names and signatures. When one of these methods is called, Penpal will immediately return a promise and then go to work sending a message to the parent, calling the actual method within the parent with the arguments you have passed, and then sending the return value back to the child. The promise you received will then be resolved with the return value.

`connection.destroy: Function`

A method that, when called, will disconnect any messaging channels. You may call this even before a connection has been established.

## Inspiration

This library is inspired by:

- [Postmate](https://github.com/dollarshaveclub/postmate)
- [JSChannel](https://github.com/mozilla/jschannel)
- [post-me](https://github.com/alesgenova/post-me)
- [comlink](https://github.com/GoogleChromeLabs/comlink)

## License

MIT
