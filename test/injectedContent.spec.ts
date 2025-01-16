import { CHILD_SERVER } from './constants';
import { connectToChild, ErrorCode } from '../src/index';
import FixtureMethods from './childFixtures/types/FixtureMethods';
import { expectRejectedConnection, getWorkerFixtureUrl } from './utils';

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
        }
      });
    </script>
  </body>
</html>
`;

describe('data URI support', () => {
  it('connects and calls a function on the child iframe if childOrigin is set to *', async () => {
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
    connection.destroy();
  });

  it('fails connection iframe if childOrigin is not set', async () => {
    const iframe = document.createElement('iframe');
    iframe.src = `data:text/html,${htmlSrc}`;
    document.body.appendChild(iframe);

    // Because a childOrigin is not set, Penpal will ask the browser for the
    // origin of the value of iframe.src. The browser will report that the
    // origin is 'null' because the data URI is considered an "opaque origin"
    // in this scenario. The browser will then throw an error when penpal uses
    // 'null' as a target origin when calling postMessage. This is all
    // intentional browser behavior and the only way around it is by
    // using '*' as the origin when calling postMessage. While penpal could
    // handle this automatically by using '*' as the target origin when
    // the derived origin is 'null', it instead forces the consumer to specify
    // a childOrigin of '*' so that they are more aware of potential
    // consequences.
    const connection = connectToChild<FixtureMethods>({
      child: iframe,
    });

    await expectRejectedConnection(connection, ErrorCode.TransmissionFailed);
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
    connection.destroy();
  });
});

describe('object URL support', () => {
  it('connects and calls a function on the child iframe', async () => {
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
    connection.destroy();
  });

  it('connects and calls a function on the child worker', async () => {
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
    connection.destroy();
  });
});

describe('iframe srcdoc support', () => {
  it('connects and calls a function on the child iframe', async () => {
    const iframe = document.createElement('iframe');
    iframe.srcdoc = htmlSrc;
    document.body.appendChild(iframe);

    const connection = connectToChild<FixtureMethods>({
      child: iframe,
    });

    const child = await connection.promise;
    const value = await child.multiply(2, 5);
    expect(value).toEqual(10);
    connection.destroy();
  });
});
