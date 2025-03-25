import { CHILD_SERVER } from './constants.js';
import { connect, WorkerMessenger, WindowMessenger } from '../src/index.js';
import FixtureMethods from './childFixtures/types/FixtureMethods.js';
import {
  expectNeverFulfilledIframeConnection,
  getWorkerFixtureUrl,
} from './utils.js';

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
    <script src="${CHILD_SERVER}/penpal.js"></script>
    <script>
      const messenger = new Penpal.WindowMessenger({
        remoteWindow: window.parent,
        allowedOrigins: ['*'],
      });
      
      Penpal.connect({
        messenger,
        methods: {
          multiply: function(num1, num2) {
            return num1 * num2;
          }
        },
        log: Penpal.debug('Child')
      });
    </script>
  </body>
</html>
`;

it('connects and calls a function on the child iframe when src is set to data URI and allowed origin is set to *', async () => {
  const iframe = document.createElement('iframe');
  iframe.src = `data:text/html,${encodeURIComponent(htmlSrc)}`;
  document.body.appendChild(iframe);

  const messenger = new WindowMessenger({
    remoteWindow: iframe.contentWindow!,
    allowedOrigins: ['*'],
  });

  const connection = connect<FixtureMethods>({
    messenger,
  });

  const child = await connection.promise;
  const value = await child.multiply(2, 5);
  expect(value).toEqual(10);
  connection.destroy();
});

it('never connects iframe when src is set to data URI and allowed origin is not set', async () => {
  const iframe = document.createElement('iframe');
  iframe.src = `data:text/html,${encodeURIComponent(htmlSrc)}`;
  document.body.appendChild(iframe);

  const messenger = new WindowMessenger({
    remoteWindow: iframe.contentWindow!,
  });

  const connection = connect<FixtureMethods>({
    messenger,
  });

  // The connection will never be fulfilled because the child origin will
  // default to window.origin, which won't match the child's origin. When
  // the child sends the SYN message to start the handshake, the parent will
  // ignore the message because the message's origin won't match what the parent
  // is expecting.
  await expectNeverFulfilledIframeConnection(connection, iframe);
});

it('connects and calls a function on the child worker when src is set to data URI', async () => {
  const response = await fetch(getWorkerFixtureUrl('webWorkerGeneral'));
  const code = await response.text();

  const worker = new Worker(
    `data:application/javascript,${encodeURIComponent(code)}`
  );

  const messenger = new WorkerMessenger({
    worker,
  });

  const connection = connect<FixtureMethods>({
    messenger,
  });

  const child = await connection.promise;
  const value = await child.multiply(2, 5);
  expect(value).toEqual(10);
  connection.destroy();
});

it('connects and calls a function on the child iframe when src is set to an object URL', async () => {
  const blob = new Blob([htmlSrc], { type: 'text/html' });
  const blobUrl = URL.createObjectURL(blob);

  const iframe = document.createElement('iframe');
  iframe.src = blobUrl;
  document.body.appendChild(iframe);

  const messenger = new WindowMessenger({
    remoteWindow: iframe.contentWindow!,
  });

  const connection = connect<FixtureMethods>({
    messenger,
  });

  const child = await connection.promise;
  const value = await child.multiply(2, 5);
  expect(value).toEqual(10);
  connection.destroy();
});

it('connects and calls a function on the child worker when src is set to an object URL', async () => {
  const response = await fetch(getWorkerFixtureUrl('webWorkerGeneral'));
  const code = await response.text();
  const blob = new Blob([code], { type: 'application/javascript' });
  const blobUrl = URL.createObjectURL(blob);

  const worker = new Worker(blobUrl);

  const messenger = new WorkerMessenger({
    worker,
  });

  const connection = connect<FixtureMethods>({
    messenger,
  });

  const child = await connection.promise;
  const value = await child.multiply(2, 5);
  expect(value).toEqual(10);
  connection.destroy();
});

it('connects and calls a function on the child iframe when srcdoc is set', async () => {
  const iframe = document.createElement('iframe');
  iframe.srcdoc = htmlSrc;
  document.body.appendChild(iframe);

  const messenger = new WindowMessenger({
    remoteWindow: iframe.contentWindow!,
  });

  const connection = connect<FixtureMethods>({
    messenger,
  });

  const child = await connection.promise;
  const value = await child.multiply(2, 5);
  expect(value).toEqual(10);
  connection.destroy();
});
