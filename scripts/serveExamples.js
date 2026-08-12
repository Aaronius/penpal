import { createServer } from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import sirv from 'sirv';

const examplesRoot = path.resolve('examples/dist');

export const startExamplesServer = ({
  host = '127.0.0.1',
  port = 4173,
} = {}) => {
  const serve = sirv(examplesRoot, { dev: true });
  const server = createServer((request, response) => {
    serve(request, response, () => {
      response.statusCode = 404;
      response.end('Not found');
    });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const address = server.address();

      if (!address || typeof address === 'string') {
        reject(new Error('Unable to determine the examples server address.'));
        return;
      }

      resolve({
        close: () =>
          new Promise((resolveClose, rejectClose) => {
            server.close((error) => {
              if (error) {
                rejectClose(error);
              } else {
                resolveClose();
              }
            });
          }),
        url: `http://${host}:${address.port}`,
      });
    });
  });
};

const entryPath = process.argv[1];

if (entryPath && import.meta.url === pathToFileURL(entryPath).href) {
  const requestedPort = Number.parseInt(process.env.PORT ?? '4173', 10);
  const server = await startExamplesServer({ port: requestedPort });
  console.log(`Penpal examples: ${server.url}`);
}
