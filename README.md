[![npm version](https://badge.fury.io/js/penpal.svg)](https://badge.fury.io/js/penpal)

### Upgrading from version 5? See [version 6 release notes](https://github.com/Aaronius/penpal/releases/tag/v6.0.0) for details.

[See documentation for 5.x](https://github.com/Aaronius/penpal/tree/5.x)  
[See documentation for 4.x](https://github.com/Aaronius/penpal/tree/4.x)  
[See documentation for 3.x](https://github.com/Aaronius/penpal/tree/3.x)

# Penpal

Penpal is a promise-based library for securely communicating with iframes via postMessage. The parent window can call methods exposed by iframes, pass arguments, and receive a return value. Similarly, iframes can call methods exposed by the parent window, pass arguments, and receive a return value. Easy peasy.

This library has no dependencies.

## Installation

### Using npm

Preferably, you'll be able to use Penpal from npm with a bundler like [Webpack](https://webpack.github.io/), [Rollup](https://rollupjs.org), or [Parcel](https://parceljs.org/). If you use npm for client package management, you can install Penpal with:

`npm install penpal`

### Using a CDN

If you don't want to use npm to manage client packages, Penpal also provides a UMD distribution in a `dist` folder which is hosted on a CDN:

`<script src="https://unpkg.com/penpal@^6/dist/penpal.min.js"></script>`

Penpal will then be installed on `window.Penpal`. `window.Penpal` will contain the following properties:

```
Penpal.connectToChild
Penpal.connectToParent
Penpal.ErrorCode.ConnectionDestroyed
Penpal.ErrorCode.ConnectionTimeout
Penpal.ErrorCode.NoIframeSrc
```

Usage is similar to if you were using a bundler, which is documented below, but instead of importing each module, you would access it on the `Penpal` global instead.

## Usage

### Parent Window

```javascript
import { connectToChild } from 'penpal';

const iframe = document.createElement('iframe');
iframe.src = 'http://example.com/iframe.html';

// This conditional is not Penpal-specific. It's merely
// an example of how you can add an iframe to the document.
if (
  document.readyState === 'complete' ||
  document.readyState === 'interactive'
) {
  document.body.appendChild(iframe);
} else {
  document.addEventListener('DOMContentLoaded', () => {
    document.body.appendChild(iframe);
  });
}

// This is where the magic begins.
const connection = connectToChild({
  // The iframe to which a connection should be made.
  iframe,
  // Methods the parent is exposing to the child.
  methods: {
    add(num1, num2) {
      return num1 + num2;
    },
  },
});

connection.promise.then((child) => {
  child.multiply(2, 6).then((total) => console.log(total));
  child.divide(12, 4).then((total) => console.log(total));
});
```

### Child Iframe

```javascript
import { connectToParent } from 'penpal';

const connection = connectToParent({
  // Methods child is exposing to parent.
  methods: {
    multiply(num1, num2) {
      return num1 * num2;
    },
    divide(num1, num2) {
      // Return a promise if the value being
      // returned requires asynchronous processing.
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(num1 / num2);
        }, 1000);
      });
    },
  },
});

connection.promise.then((parent) => {
  parent.add(3, 1).then((total) => console.log(total));
});
```

## API

### `connectToChild(options: Object) => Object`

**For Penpal to operate correctly, you must ensure that `connectToChild` is called before the iframe calls `connectToParent`.** As shown in the example above, it is safe to set the `src` or `srcdoc` property of the iframe and append the iframe to the document before calling `connectToChild` as long as they are both done in the same [JavaScript event loop](https://developer.mozilla.org/en-US/docs/Web/JavaScript/EventLoop). Alternatively, you can always append the iframe to the document _after_ calling `connectToChild` instead of _before_.

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

## Reconnection

If the child iframe attempts to reconnect with the parent, the parent will accept the new connection. This could happen, for example, if a user refreshes the child iframe or navigates within the iframe to a different page that also uses Penpal. In this case, the `child` object the parent received when the initial connection was established will be updated with the new methods provided by the child iframe.

NOTE: Currently there is no API to notify consumers of a reconnection. If this is important for you, please provide feedback on [this issue](https://github.com/Aaronius/penpal/issues/58) with how you would like to see the API designed.

## Errors

Penpal will throw (or reject promises with) errors in certain situations. Each error will have a `code` property which may be used for programmatic decisioning (e.g., do something if the error was due to a connection timing out) along with a `message` describing the problem. Errors may be thrown with the following codes:

`ConnectionDestroyed`

This error will be thrown when attempting to call a method on `child` or `parent` objects and the connection was previously destroyed.

`ConnectionTimeout`

The promise found at `connection.promise` will be rejected with this error after the `timeout` duration has elapsed and a connection has not been established.

`NoIframeSrc`

This error will be thrown when the iframe passed into `connectToChild` does not have `src` or `srcdoc` set.

For your convenience, these error codes can be imported as follows:

```
import { ErrorCode } from 'penpal';
// ErrorCode.ConnectionDestroyed
// ErrorCode.ConnectionTimeout
// ErrorCode.NoIframeSrc
```

## TypeScript

When calling `connectToChild` or `connectToParent`, you may pass a generic type argument. This will be used to type the `child` or `parent` object that `connection.promise` is resolved with. This is better explained in code:

```typescript
import { connectToChild } from 'penpal';

// This interace could be imported from a code library
// that both the parent and child share.
interface ChildApi {
  multiply(...args: number[]): number;
}

// Supply the interface as a generic argument.
const connection = connectToChild<ChildApi>({
  iframe: new HTMLIFrameElement(),
});

// The resulting child object will contain properly
// typed methods.
const child = await connection.promise;
// The result variable is typed as a number.
const result = await child.multiply(1, 3);
```

The following TypeScript types are also exported as named constants for your use:

- `Connection`
- `Methods`
- `AsyncMethodReturns`
- `CallSender`
- `PenpalError`

## React

If you're using Penpal within a React app, please check out [react-penpal](https://github.com/Lunuy/react-penpal).

## Supported Browsers

Penpal is designed to run successfully on the most recent versions of Chrome, Firefox, Safari, and Edge. If you need to support Internet Explorer 11, feel free to use version 3.x of Penpal. See the [3.x README](https://github.com/Aaronius/penpal/tree/3.x) for documentation.

Penpal has also been reported to work within Ionic projects on iOS and Android devices.

## Inspiration

This library is inspired by:

- [Postmate](https://github.com/dollarshaveclub/postmate)
- [JSChannel](https://github.com/mozilla/jschannel)

## License

MIT
