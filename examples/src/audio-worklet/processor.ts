import { PortMessenger, connect } from 'penpal';

// These globals are available inside the AudioWorklet module.
declare const AudioWorkletProcessor: new () => { readonly port: MessagePort };
declare function registerProcessor(
  name: string,
  processor: new () => {
    process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean;
  },
): void;

class ToneProcessor extends AudioWorkletProcessor {
  #muted = false;

  constructor() {
    super();
    connect({
      messenger: new PortMessenger({ port: this.port }),
      methods: {
        setMuted: (muted: boolean) => {
          this.#muted = muted;
          return this.#muted;
        },
      },
    });
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    // The oscillator is mono. Leave the output silent when muted.
    const input = inputs[0]?.[0];
    const output = outputs[0]?.[0];
    if (!this.#muted && input && output) {
      output.set(input);
    }
    return true;
  }
}

registerProcessor('tone-processor', ToneProcessor);
