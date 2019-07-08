[![npm version](https://badge.fury.io/js/penpal.svg)](https://badge.fury.io/js/penpal)

### Upgrading from version 3? See [version 4 release notes](https://github.com/Aaronius/penpal/releases/tag/v4.0.0) for details.

# Penpal

Penpal is a promise-based library for securely communicating with iframes via postMessage. The parent window can call methods exposed by iframes, pass arguments, and receive a return value. Similarly, iframes can call methods exposed by the parent window, pass arguments, and receive a return value. Easy peasy.

This library has no dependencies.

## Installation

### Using npm

Preferably, you'll be able to use Penpal from npm with a bundler like [Webpack](https://webpack.github.io/), [Rollup](https://rollupjs.org), or [Parcel](https://parceljs.org/). If you use npm for client package management, you can install Penpal with:

`npm install penpal --save`

### Using a CDN

If you don't want to use npm to manage client packages, Penpal also provides a UMD distribution in a `dist` folder which is hosted on a CDN:

`<script src="https://unpkg.com/penpal/dist/penpal.min.js"></script>`

Penpal will then be installed on `window.Penpal`. `window.Penpal` will contain the following properties:

```
Penpal.ERR_CONNECTION_DESTROYED
Penpal.ERR_CONNECTION_TIMEOUT
Penpal.ERR_NOT_IN_IFRAME
Penpal.ERR_NO_IFRAME_SRC
Penpal.connectToChild
Penpal.connectToParent
```

Usage is similar to if you were using a bundler, which is documented below, but instead of importing each module, you would access it on the `Penpal` global instead.

## Usage

### Parent Window

```javascript
import connectToChild from 'penpal/lib/connectToChild';

const iframe = document.createElement('iframe');
iframe.src = 'http://example.com/iframe.html';
document.body.appendChild(iframe);

const connection = connectToChild({
  // The iframe to which a connection should be made
  iframe,
  // Methods the parent is exposing to the child
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
import connectToParent from 'penpal/lib/connectToParent';

const connection = connectToParent({
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

**For Penpal to operate correctly, you must ensure that `connectToChild` is called before the iframe has called `connectToParent`.** As shown in the example above, it is safe to set the `src` or `srcdoc` property of the iframe and append the iframe to the document before calling `connectToChild` as long as they are both done in the same [JavaScript event loop](https://developer.mozilla.org/en-US/docs/Web/JavaScript/EventLoop). Alternatively, you can always append the iframe to the document _after_ calling `connectToChild` instead of _before_.

#### Options

`options.iframe` (required) The iframe element to which Penpal should connect. Unless you provide the `childOrigin` option, you will need to have set either the `src` or `srcdoc` property on the iframe prior to calling `connectToChild` so that Penpal can automatically derive the child origin. In addition to regular URLs, [data URIs](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs) and [file URIs](https://en.wikipedia.org/wiki/File_URI_scheme) are also supported.

`options.methods` (optional) An object containing methods which should be exposed for the child iframe to call. The keys of the object are the method names and the values are the functions. If a function requires asynchronous processing to determine its return value, make the function immediately return a promise and resolve the promise once the value has been determined.

`options.childOrigin` (optional) In the vast majority of cases, Penpal can automatically determine the child origin based on the `src` or `srcdoc` property that you have set on the iframe. Unfortunately, browsers are inconsistent in certain cases, particularly when using the `file://` protocol on various devices. If you receive an error saying that the parent received a hanshake from an unexpected origin, you may need to manually pass the child origin using this option.

`options.timeout` (optional) The amount of time, in milliseconds, Penpal should wait for the child to respond before rejecting the connection promise. There is no timeout by default.

`options.debug` (optional) Enables or disables debug logging. Debug logging is disabled by default.

#### Return value

The return value of `connectToChild` is a `connection` object with the following properties:

`connection.promise` A promise which will be resolved once communication has been established. The promise will be resolved with an object containing the methods which the child has exposed. Note that these aren't actual memory references to the methods the child exposed, but instead proxy methods Penpal has created with the same names and signatures. When one of these methods is called, Penpal will immediately return a promise and then go to work sending a message to the child, calling the actual method within the child with the arguments you have passed, and then sending the return value back to the parent. The promise you received will then be resolved with the return value.

`connection.destroy` A method that, when called, will disconnect any messaging channels. You may call this even before a connection has been established.

### `connectToParent([options:Object]) => Object`

#### Options

`options.parentOrigin` (optional) The origin of the parent window which your iframe will be communicating with. If this is not provided, communication will not be restricted to any particular parent origin resulting in any webpage being able to load your webpage into an iframe and communicate with it.

`options.methods` (optional) An object containing methods which should be exposed for the parent window to call. The keys of the object are the method names and the values are the functions. If a function requires asynchronous processing to determine its return value, make the function immediately return a promise and resolve the promise once the value has been determined.

`options.timeout` (optional) The amount of time, in milliseconds, Penpal should wait for the parent to respond before rejecting the connection promise. There is no timeout by default.

`options.debug` (optional) Enables or disables debug logging. Debug logging is disabled by default.

#### Return value

The return value of `connectToParent` is a `connection` object with the following property:

`connection.promise` A promise which will be resolved once communication has been established. The promise will be resolved with an object containing the methods which the parent has exposed. Note that these aren't actual memory references to the methods the parent exposed, but instead proxy methods Penpal has created with the same names and signatures. When one of these methods is called, Penpal will immediately return a promise and then go to work sending a message to the parent, calling the actual method within the parent with the arguments you have passed, and then sending the return value back to the child. The promise you received will then be resolved with the return value.

`connection.destroy` A method that, when called, will disconnect any messaging channels. You may call this even before a connection has been established.

## Reconnection

If the child iframe attempts to reconnect with the parent, the parent will accept the new connection. This could happen, for example, if a user refreshes the child iframe or navigates within the iframe to a different page that also uses Penpal. In this case, the `child` object the parent received when the initial connection was established will be updated with the new methods provided by the child iframe.

NOTE: Currently there is no API to notify consumers of a reconnection. If this is important for you, please file an issue and explain why it would be beneficial to you.

## Errors

Penpal will throw (or reject promises with) errors in certain situations. Each error will have a `code` property which may be used for programmatic decisioning (e.g., do something if the error was due to a connection timing out) along with a `message` describing the problem. Errors may be thrown with the following codes:

- `ConnectionDestroyed`
  - `connection.promise` will be rejected with this error if the connection is destroyed (by calling `connection.destroy()`) while Penpal is attempting to establish the connection.
  - This error will be thrown when attempting to call a method on `child` or `parent` objects and the connection was previously destroyed.
- `ConnectionTimeout`
  - `connection.promise` will be rejected with this error after the `timeout` duration has elapsed and a connection has not been established.
- `NotInIframe`
  - This error will be thrown when attempting to call `connectToParent()` from outside of an iframe context.
- `NoIframeSrc`
  - This error will be thrown when the iframe passed into `connectToChild` does not have `src` or `srcdoc` set.

For your convenience, these error codes are exported as constants that can be imported as follows:

```
import {
  ERR_CONNECTION_DESTROYED,
  ERR_CONNECTION_TIMEOUT,
  ERR_NOT_IN_IFRAME,
  ERR_NO_IFRAME_SRC
} from 'penpal/lib/errorCodes';
```

## Supported Browsers

Penpal is designed to run successfully on the most recent versions of Chrome, Firefox, Safari, and Edge. If you need to support Internet Explorer 11, feel free to use version 3.x of Penpal. See the [3.x README](https://github.com/Aaronius/penpal/tree/3.x) for documentation.

## Inspiration

This library is inspired by:

- [Postmate](https://github.com/dollarshaveclub/postmate)
- [JSChannel](https://github.com/mozilla/jschannel)

## License

MIT
