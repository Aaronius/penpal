import { CHILD_SERVER } from './constants';

const htmlSrc = `
<!DOCTYPE html>
<html>
  <body>
    <script type="text/javascript" src="${CHILD_SERVER}/penpal.js"></script>
    <script type="text/javascript">
      Penpal.connectToParent({
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

const htmlSrcRedirect = `
<!DOCTYPE html>
<html>
  <head>
    <script>
      document.location = '${CHILD_SERVER}/default.html'
    </script>
  </head>
</html>
`;

describe('data URI support', () => {
  it('connects and calls a function on the child', async () => {
    const iframe = document.createElement('iframe');
    iframe.src = `data:text/html,${htmlSrc}`;
    document.body.appendChild(iframe);

    const connection = Penpal.connectToChild({
      iframe,
    });

    const child = await connection.promise;
    const value = await child.multiply(2, 5);
    expect(value).toEqual(10);
    connection.destroy();
  });

  it('does not connect if child redirects to non-opaque origin', (done) => {
    const iframe = document.createElement('iframe');
    iframe.src = `data:text/html,${htmlSrcRedirect}`;
    document.body.appendChild(iframe);

    const connection = Penpal.connectToChild({
      iframe,
    });

    const connectionResolved = jasmine.createSpy().and.callFake(() => {
      connection.destroy();
    });

    connection.promise.then(connectionResolved);

    setTimeout(() => {
      expect(connectionResolved).not.toHaveBeenCalled();
      done();
    }, 200);
  });
});

var supportsSrcDoc = !!('srcdoc' in document.createElement('iframe'));

if (supportsSrcDoc) {
  describe('srcdoc support', () => {
    it('connects and calls a function on the child', async () => {
      const iframe = document.createElement('iframe');
      iframe.srcdoc = htmlSrc;
      document.body.appendChild(iframe);

      const connection = Penpal.connectToChild({
        iframe,
      });

      const child = await connection.promise;
      const value = await child.multiply(2, 5);
      expect(value).toEqual(10);
      connection.destroy();
    });

    it('does not connect if child redirects to non-opaque origin', (done) => {
      const iframe = document.createElement('iframe');
      iframe.srcdoc = htmlSrcRedirect;
      document.body.appendChild(iframe);

      const connection = Penpal.connectToChild({
        iframe,
      });

      const connectionResolved = jasmine.createSpy().and.callFake(() => {
        connection.destroy();
      });

      connection.promise.then(connectionResolved);

      setTimeout(() => {
        expect(connectionResolved).not.toHaveBeenCalled();
        done();
      }, 200);
    });
  });
}
