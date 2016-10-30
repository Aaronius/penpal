# PenPal

PenPal is a promise-based library for securely communicating with iframes via postMessage. The parent window can call methods exposed by iframes, pass arguments, and receive a return value. Similarly, iframes can call methods exposed by the parent window, pass arguments, and receive a return value. Easy peasy.

The total size of the library is about 3 KB minified.

## Installation

`npm install penpal --save`

## Usage

### Parent Window

```javascript
const PenPal from 'penpal';

PenPal.connectToChild({
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
}).then(child => {
  child.multiply(2, 6).then(total => console.log(total));
  child.divide(12, 4).then(total => console.log(total));
});
```

### Child Iframe

```javascript
const PenPal from 'penpal';

PenPal.connectToParent({
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
}).then(parent => {
  parent.add(3, 1).then(total => console.log(total));
});
```

## API

### `connectToChild(options:Object) => Promise`

#### Parameters

`options.url` (required) The URL of the webpage that should be loaded into the iframe that PenPal will create.

`options.appendTo` (optional) The element to which the created iframe should be appended. If not provided, the iframe will be appended to `document.body`.

`options.methods` (optional) An object containing methods which should be exposed for the child iframe to call. The keys of the object are the method names and the values are the functions. If a function requires asynchronous processing to determine its return value, make the function immediately return a promise and resolve the promise once the value has been determined.

#### Return value

The return value of `connectToChild` is a Promise which will be resolved once communication has been established. The promise will be resolved with a `child` object containing the methods which the child has exposed. The `child` object will also contain two other special properties:

`child.iframe` The child iframe element.

`child.destroy` A method that, when called, will remove the iframe element from the DOM and clean up event listeners.

### `connectToParent(options:Object) => Promise`

#### Parameters

`options.parentOrigin` (optional) The origin of the parent window which your iframe will be communicating with. If this is not provided, communication will not be restricted to any particular parent origin resulting in any webpage being able to load your webpage into an iframe and communicate with it.

`options.methods` (optional) An object containing methods which should be exposed for the parent window to call. The keys of the object are the method names and the values are the functions. If a function requires asynchronous processing to determine its return value, make the function immediately return a promise and resolve the promise once the value has been determined.

#### Return value

The return value of `connectToParent` is a Promise which will be resolved once communication has been established. The promise will be resolved with a `parent` object containing the methods which the parent has exposed.

### `Promise`

Setting `PenPal.Promise` to a Promise constructor provides PenPal with a promise implementation that it will use. If a promise implementation is not provided by the consumer, PenPal will attempt to use `window.Promise`.

### `debug`

Setting `PenPal.debug` to `true` or `false` enables or disables debug logging. Debug logging is disabled by default.

## Inspiration

This library is inspired by:

* [Postmate](https://github.com/dollarshaveclub/postmate)
* [JSChannel](https://github.com/mozilla/jschannel)

## License

MIT
