const debug = (prefix?: string) => {
  return (...args: unknown[]) => {
    console.log(`✍️ %c${prefix}%c`, 'font-weight: bold;', '', ...args);
  };
};

export default debug;
