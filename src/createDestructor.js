export default () => {
  const callbacks = [];
  let destroyed = false;

  return {
    destroy() {
      destroyed = true;
      callbacks.forEach(callback => {
        callback();
      });
    },
    onDestroy(callback) {
      destroyed ? callback() : callbacks.push(callback);
    }
  };
};
