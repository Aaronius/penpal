/**
 * @return A unique ID
 */
// crypto.randomUUID is not available in insecure contexts.
export default crypto.randomUUID?.bind(crypto) ??
  (() =>
    new Array(4)
      .fill(0)
      .map(() =>
        Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(16)
      )
      .join('-'));
