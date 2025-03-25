import { Log } from './types.js';

const debug = (prefix?: string): Log => {
  return (...args: unknown[]) => {
    console.log(`✍️ %c${prefix}%c`, 'font-weight: bold;', '', ...args);
  };
};

export default debug;
