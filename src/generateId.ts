/**
 * @return A unique ID
 */
// randomUUID is unavailable in insecure contexts, and worklets may lack crypto.
const generateId: () => string =
  globalThis.crypto?.randomUUID?.bind(globalThis.crypto) ??
  (() =>
    new Array(4)
      .fill(0)
      .map(() =>
        Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(16),
      )
      .join('-'));

export default generateId;
