// eslint-disable-next-line @typescript-eslint/no-explicit-any
const once = <T extends (...args: any[]) => any>(
  fn: T
): ((...args: Parameters<T>) => ReturnType<T>) => {
  let isCalled = false;
  let result: ReturnType<T>;

  return (...args: Parameters<T>): ReturnType<T> => {
    if (!isCalled) {
      isCalled = true;
      result = fn(...args);
    }
    return result;
  };
};

export default once;
