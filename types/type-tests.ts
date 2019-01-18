import Penpal from 'penpal';

const parentMethods = {
  add(num1: number, num2: number): number {
    return num1 + num2;
  }
};

const childMethods = {
  multiply(num1: number, num2: number) {
    return num1 * num2;
  },
  divide(num1: number, num2: number) {
    // Return a promise if the value being returned requires asynchronous processing.
    return new Promise<number>(resolve => {
      setTimeout(() => {
        resolve(num1 / num2);
      }, 1000);
    });
  }
};

/**
 * Parent Window
 */

const parentContainer = document.getElementById('iframeContainer');
if (!parentContainer) throw new Error('Parent container not found');

const iframeToUse = document.createElement('iframe');
if (!iframeToUse) throw new Error('Parent iframe element has not been created');

const permissiveParentConnection = Penpal.connectToChild({
  // URL of page to load into iframe.
  url: 'http://example.com/iframe.html',
  // Container to which the iframe should be appended.
  appendTo: parentContainer,
  // iframe to use
  iframe: iframeToUse,
  // Methods parent is exposing to child
  methods: parentMethods
});

permissiveParentConnection.promise.then(child => {
  child.multiply(2, 6); // $ExpectType any
  child.foo(12, 4); // $ExpectType any
});

const strictParentConnection = Penpal.connectToChild<typeof childMethods>({
  // URL of page to load into iframe.
  url: 'http://example.com/iframe.html',
  // Container to which the iframe should be appended.
  appendTo: parentContainer,
  // iframe to use
  iframe: iframeToUse,
  // Methods parent is exposing to child
  methods: parentMethods
});

strictParentConnection.promise.then(child => {
  child.multiply(2, 6).then(total => {
    total; // $ExpectType number
  });
  child.divide(12, 4).then(total => {
    total; // $ExpectType number
  });
  child.foo(12, 4); // $ExpectError
});

/**
 * Child Frame (flexible)
 */
const flexibleChildConnection = Penpal.connectToParent({
  // Methods child is exposing to parent
  methods: childMethods
});

flexibleChildConnection.promise.then(parent => {
  parent.add(3, 1); // $ExpectType any
});
/**
 * Child Frame (strict)
 */
const strictChildConnection = Penpal.connectToParent<typeof parentMethods>({
  // Methods child is exposing to parent
  methods: childMethods
});

strictChildConnection.promise.then(parent => {
  parent.add(3, 1).then(total => {
    total; // $ExpectType number
  });
});
