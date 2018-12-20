[![npm version](https://badge.fury.io/js/penpal.svg)](https://badge.fury.io/js/penpal) [![Build Status](https://travis-ci.org/Aaronius/penpal.svg?branch=master)](https://travis-ci.org/Aaronius/penpal)

[![Build Status](https://saucelabs.com/browser-matrix/Aaronius9erPenpalMaster.svg)](https://saucelabs.com/u/Aaronius9erPenpalMaster)

# Penpal

Penpal is a promise-based library for securely communicating with iframes via postMessage. The parent window can call methods exposed by iframes, pass arguments, and receive a return value. Similarly, iframes can call methods exposed by the parent window, pass arguments, and receive a return value. Easy peasy.

The total size of the library is approximately 5 KB minified and 2 KB gzipped. It has no dependencies.

## Installation

### Using npm

Preferably, you'll be able to use Penpal from npm with a bundler like [Webpack](https://webpack.github.io/) or [Parcel](https://parceljs.org/). If you use npm for client package management, you can install Penpal with:

`npm install penpal --save`

And import Penpal into your code with something like:

`import Penpal from 'penpal';`

#### TypeScript

Penpal provides a `types` file for usage with TypeScript; importing is simply the same as above.

### Using a CDN

If you don't want to use npm to manage client packages, Penpal also provides a UMD distribution in a `dist` folder which is hosted on a CDN:

`<script src="https://unpkg.com/penpal/dist/penpal.min.js"></script>`

Penpal will then be installed on `window.Penpal`.

## Usage

### Parent Window

```javascript
import Penpal from 'penpal';

const connection = Penpal.connectToChild({
  // URL of page to load into iframe.
  url: 'http://example.com/iframe.html',
  // Container to which the iframe should be appended.
  appendTo: document.getElementById('iframeContainer'),
  // Methods parent is exposing to child
  methods: {
    add(num1, num2) {
      return num1 + num2;
    }
  }
});

connection.promise.then(child => {
  child.multiply(2, 6).then(total => console.log(total));
  child.divide(12, 4).then(total => console.log(total));
});
```

### Child Iframe

```javascript
import Penpal from 'penpal';

const connection = Penpal.connectToParent({
  // Methods child is exposing to parent
  methods: {
    multiply(num1, num2) {
      return num1 * num2;
    },
    divide(num1, num2) {
      // Return a promise if the value being returned requires asynchronous processing.
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(num1 / num2);
        }, 1000);
      });
    }
  }
});

connection.promise.then(parent => {
  parent.add(3, 1).then(total => console.log(total));
});
```

## API

### `connectToChild(options:Object) => Object`

#### Parameters

`options.url` (required) The URL of the webpage that should be loaded into the iframe that Penpal will create. A relative path is also supported.

`options.appendTo` (optional) The element to which the created iframe should be appended. If not provided, the iframe will be appended to `document.body`.

`options.methods` (optional) An object containing methods which should be exposed for the child iframe to call. The keys of the object are the method names and the values are the functions. If a function requires asynchronous processing to determine its return value, make the function immediately return a promise and resolve the promise once the value has been determined.

`options.timeout` (optional) The amount of time, in milliseconds, Penpal should wait for the child to respond before rejecting the connection promise. There is no timeout by default.

#### Return value

The return value of `connectToChild` is a `connection` object with the following properties:

`connection.promise` A promise which will be resolved once communication has been established. The promise will be resolved with an object containing the methods which the child has exposed. Note that these aren't actual memory references to the methods the child exposed, but instead proxy methods Penpal has created with the same names and signatures. When one of these methods is called, Penpal will immediately return a promise and then go to work sending a message to the child, calling the actual method within the child with the arguments you have passed, and then sending the return value back to the parent. The promise you received will then be resolved with the return value.

`connection.destroy` A method that, when called, will remove the iframe element from the DOM and disconnect any messaging channels. You may call this even before a connection has been established.

`connection.iframe` The child iframe element. The iframe will have already been appended as a child to the element defined in `options.appendTo`, but a reference to the iframe is provided in case you need to add CSS classes, etc.

### `connectToParent([options:Object]) => Object`

#### Parameters

`options.parentOrigin` (optional) The origin of the parent window which your iframe will be communicating with. If this is not provided, communication will not be restricted to any particular parent origin resulting in any webpage being able to load your webpage into an iframe and communicate with it.

`options.methods` (optional) An object containing methods which should be exposed for the parent window to call. The keys of the object are the method names and the values are the functions. If a function requires asynchronous processing to determine its return value, make the function immediately return a promise and resolve the promise once the value has been determined.

`options.timeout` (optional) The amount of time, in milliseconds, Penpal should wait for the parent to respond before rejecting the connection promise. There is no timeout by default.

#### Return value

The return value of `connectToParent` is a `connection` object with the following property:

`connection.promise` A promise which will be resolved once communication has been established. The promise will be resolved with an object containing the methods which the parent has exposed. Note that these aren't actual memory references to the methods the parent exposed, but instead proxy methods Penpal has created with the same names and signatures. When one of these methods is called, Penpal will immediately return a promise and then go to work sending a message to the parent, calling the actual method within the parent with the arguments you have passed, and then sending the return value back to the child. The promise you received will then be resolved with the return value.

`connection.destroy` A method that, when called, will disconnect any messaging channels. You may call this even before a connection has been established.

### `Promise`

Setting `Penpal.Promise` to a Promise constructor provides Penpal with a promise implementation that it will use. If a promise implementation is not provided by the consumer, Penpal will attempt to use `window.Promise`.

### `debug`

Setting `Penpal.debug` to `true` or `false` enables or disables debug logging. Debug logging is disabled by default.

## Reconnection

If the child iframe attempts to reconnect with the parent, the parent will accept the new connection. This could happen, for example, if a user refreshes the child iframe or navigates within the iframe to a different page that also uses Penpal. In this case, the `child` object the parent received when the initial connection was established will be updated with the new methods provided by the child iframe.

NOTE: Currently there is no API to notify consumers of a reconnection. If this is important for you, please file an issue and explain why it would be beneficial to you.

## Errors

Penpal will throw (or reject promises with) errors in certain situations. Each error will have a `code` property which may be used for programmatic decisioning (e.g., do something if the error was due to a connection timing out) along with a `message` describing the problem. Errors may be thrown with the following codes:

* `Penpal.ERR_CONNECTION_DESTROYED`
  * `connection.promise` will be rejected with this error if the connection is destroyed (by calling `connection.destroy()`) while Penpal is attempting to establish the connection.
  * This error will be thrown when attempting to call a method on `child` or `parent` objects and the connection was previously destroyed.
* `Penpal.ERR_CONNECTION_TIMEOUT`
  * `connection.promise` will be rejected with this error after the `timeout` duration has elapsed and a connection has not been established.
* `Penpal.ERR_NOT_IN_IFRAME`
  * This error will be thrown when attempting to call `Penpal.connectToParent()` from outside of an iframe context.

While these error codes are on the Penpal object itself, they are also named exports. You may import them as follows:

```
import {
  ERR_CONNECTION_DESTROYED,
  ERR_CONNECTION_TIMEOUT,
  ERR_NOT_IN_IFRAME
} from 'penpal';
```

This provides an opportunity for build optimization (using tools like Webpack or Rollup) in cases where code only needs access to the error constants and not the rest of Penpal.

## Supported Browsers

Penpal is designed to run successfully on the most recent versions of Internet Explorer, Edge, Chrome, Firefox, and Safari.

## Inspiration

This library is inspired by:

* [Postmate](https://github.com/dollarshaveclub/postmate)
* [JSChannel](https://github.com/mozilla/jschannel)

## License

MIT
