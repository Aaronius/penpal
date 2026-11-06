import { CallOptions, PortMessenger, connect } from 'penpal';
import type { Connection } from 'penpal';
import { createExampleUi, getRequiredElement } from '../shared/ui.js';

interface ProcessorMethods {
  setMuted(muted: boolean): boolean;
}

const ui = createExampleUi();
const startButton = getRequiredElement<HTMLButtonElement>('[data-start]');
const muteButton = getRequiredElement<HTMLButtonElement>('[data-mute]');
const stopButton = getRequiredElement<HTMLButtonElement>('[data-stop]');
const tone = getRequiredElement<HTMLOutputElement>('[data-tone]');

const start = async () => {
  const context = new AudioContext();
  let connection: Connection<ProcessorMethods> | undefined;

  try {
    // Resume from the Start click so the browser allows audio playback.
    await context.resume();
    await context.audioWorklet.addModule(
      new URL('./processor.js', import.meta.url),
    );
    const node = new AudioWorkletNode(context, 'tone-processor');
    const oscillator = context.createOscillator();
    oscillator.frequency.value = 220;
    const gain = context.createGain();
    gain.gain.value = 0.03;
    oscillator.connect(node).connect(gain).connect(context.destination);

    connection = connect<ProcessorMethods>({
      messenger: new PortMessenger({ port: node.port }),
      timeout: 5000,
    });
    const processor = await connection.promise;
    oscillator.start();

    return {
      processor,
      stop: async () => {
        connection?.destroy();
        await context.close();
      },
    };
  } catch (error) {
    connection?.destroy();
    await context.close();
    throw error;
  }
};

let session: Awaited<ReturnType<typeof start>> | undefined;
let muted = false;

const showTone = () => {
  tone.value = muted ? 'Muted' : 'Playing';
  muteButton.textContent = muted ? 'Unmute' : 'Mute';
};

const startTone = async () => {
  startButton.disabled = true;
  ui.setState('connecting', 'Connecting');

  try {
    session = await start();
    muted = false;
    showTone();
    muteButton.disabled = false;
    stopButton.disabled = false;
    ui.setState('connected', 'Connected');
  } catch (error) {
    ui.fail(error);
    startButton.disabled = false;
  }
};

const toggleMute = async () => {
  if (!session) {
    return;
  }

  muteButton.disabled = true;
  stopButton.disabled = true;

  try {
    muted = await session.processor.setMuted(
      !muted,
      new CallOptions({ timeout: 5000 }),
    );
    showTone();
    ui.setState('connected', 'Connected');
  } catch (error) {
    ui.fail(error);
  } finally {
    muteButton.disabled = false;
    stopButton.disabled = false;
  }
};

const stopTone = async () => {
  if (!session) {
    return;
  }

  muteButton.disabled = true;
  stopButton.disabled = true;

  try {
    await session.stop();
    tone.value = 'Stopped';
    ui.setState('ready', 'Ready');
  } catch (error) {
    ui.fail(error);
  } finally {
    session = undefined;
    startButton.disabled = false;
  }
};

startButton.addEventListener('click', () => void startTone());
muteButton.addEventListener('click', () => void toggleMute());
stopButton.addEventListener('click', () => void stopTone());
