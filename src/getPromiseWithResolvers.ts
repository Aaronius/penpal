// Just use the native Promise.withResolvers() once it gains a bit more
// adoption. Safari was the last major browser to support it, which happened
// on March 5, 2024 in Safari 17.4.
const getPromiseWithResolvers = <ResolvedValueType, RejectedValueType>() => {
  let resolve: (value: ResolvedValueType) => void;
  let reject: (error: RejectedValueType) => void;

  const promise = new Promise<ResolvedValueType>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    resolve: resolve!,
    reject: reject!,
  };
};

export default getPromiseWithResolvers;
