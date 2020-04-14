export type Destructor = {
  destroy(): void,
  onDestroy(callback: Function): void
}

export default (): Destructor => {
  const callbacks: Function[] = [];
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
