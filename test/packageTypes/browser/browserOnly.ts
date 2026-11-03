import {
  CallOptions,
  PortMessenger,
  Reply,
  WebWorkerMessenger,
  WindowMessenger,
  connect,
} from 'penpal';

declare const worker: Worker;
declare const transferables: Transferable[];
declare const image: ImageBitmap;
declare const canvas: OffscreenCanvas;
declare const video: VideoFrame;

void connect({ messenger: new WebWorkerMessenger({ worker }) });
void connect({
  messenger: new WindowMessenger({ remoteWindow: window.parent }),
});

const { port1, port2 } = new MessageChannel();
void new PortMessenger({ port: port1 });
void new CallOptions({ transferables });
void new CallOptions({ transferables: [port2, image, canvas, video] });
void new Reply(port2, { transferables: [port2] });

// @ts-expect-error Null cannot be transferred.
void new CallOptions({ transferables: [null] });
