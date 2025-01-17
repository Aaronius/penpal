import { CHILD_SERVER } from './constants';
import { connectToChild } from '../src/index';
import FixtureMethods from './childFixtures/types/FixtureMethods';
import {
  expectNeverFulfilledIframeConnection,
  getWorkerFixtureUrl,
} from './utils';

const htmlSrc = `
<!DOCTYPE html>
<html>
  <head>
    <title>Test Iframe</title>
  </head>
  <body>
    Test Iframe
    <!--
    When this HTML is loaded into an iframe usng a data URI, the browser
    treats the HTML as an inline resource. Any external URLs 
    (such as /penpal.js) will be relative to the inline resource itself and
    not relative to the parent document that contains the iframe. 
    This is why we must specify a server in this script's src rather than
    just specify a path of /penpal.js.
    -->
    <script  src="${CHILD_SERVER}/penpal.js"></script>
    <script >
      Penpal.connectToParent({
        parentOrigin: "*",
        methods: {
          multiply: function(num1, num2) {
            return num1 * num2;
          }
        },
        debug: true
      });
    </script>
  </body>
</html>
`;

it('connects and calls a function on the child iframe when src is set to data URI and childOrigin is set to *', async () => {
  const iframe = document.createElement('iframe');
  iframe.src = `data:text/html,${htmlSrc}`;
  document.body.appendChild(iframe);

  const connection = connectToChild<FixtureMethods>({
    childOrigin: '*',
    child: iframe,
  });

  const child = await connection.promise;
  const value = await child.multiply(2, 5);
  expect(value).toEqual(10);
  connection.close();
});

it('never connects iframe when src is set to data URI and childOrigin is not set', async () => {
  const iframe = document.createElement('iframe');
  iframe.src = `data:text/html,${htmlSrc}`;
  document.body.appendChild(iframe);

  const connection = connectToChild<FixtureMethods>({
    child: iframe,
  });

  /*
    The connection will never be fulfilled because the parent will fail to
    derive a valid child origin and will fall back to a child origin of
    window.origin, which won't match the child's origin. When the child
    sends the SYN message to start the handshake, the parent will ignore
    the message because the message's origin won't match what the parent
    is expecting. This is the intended behavior, but could be debated
    whether it's ideal.
    */
  await expectNeverFulfilledIframeConnection(connection, iframe);
});

it('connects and calls a function on the child worker', async () => {
  const response = await fetch(getWorkerFixtureUrl('general'));
  const code = await response.text();
  const worker = new Worker(`data:application/javascript,${code}`, {
    type: 'module',
  });

  const connection = connectToChild<FixtureMethods>({
    child: worker,
  });

  const child = await connection.promise;
  const value = await child.multiply(2, 5);
  expect(value).toEqual(10);
  connection.close();
});

it('connects and calls a function on the child iframe when src is set to an object URL', async () => {
  const blob = new Blob([htmlSrc], { type: 'text/html' });
  const blobUrl = URL.createObjectURL(blob);

  const iframe = document.createElement('iframe');
  iframe.src = blobUrl;
  document.body.appendChild(iframe);

  const connection = connectToChild<FixtureMethods>({
    child: iframe,
  });

  const child = await connection.promise;
  const value = await child.multiply(2, 5);
  expect(value).toEqual(10);
  connection.close();
});

it('connects and calls a function on the child worker when src is set to an object URL', async () => {
  const response = await fetch(getWorkerFixtureUrl('general'));
  const code = await response.text();
  const blob = new Blob([code], { type: 'application/javascript' });
  const blobUrl = URL.createObjectURL(blob);

  const worker = new Worker(blobUrl);

  const connection = connectToChild<FixtureMethods>({
    child: worker,
  });

  const child = await connection.promise;
  const value = await child.multiply(2, 5);
  expect(value).toEqual(10);
  connection.close();
});

it('connects and calls a function on the child iframe when srcdoc is set', async () => {
  const iframe = document.createElement('iframe');
  iframe.srcdoc = htmlSrc;
  document.body.appendChild(iframe);

  const connection = connectToChild<FixtureMethods>({
    child: iframe,
  });

  const child = await connection.promise;
  const value = await child.multiply(2, 5);
  expect(value).toEqual(10);
  connection.close();
});
