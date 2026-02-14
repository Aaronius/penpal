(() => {
  window.onerror = function () {
    console.log.apply(console, arguments);
  };

  const getParentOrigin = () => {
    try {
      return window.parent.location.origin;
    } catch {
      return new URL(document.referrer).origin;
    }
  };

  const escapeRegExp = (value) => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  const connectToParent = ({ methods, parentOrigin, debug = true } = {}) => {
    const options = { debug };

    if (methods !== undefined) {
      options.methods = methods;
    }

    if (parentOrigin !== undefined) {
      options.parentOrigin = parentOrigin;
    }

    return Penpal.connectToParent(options);
  };

  window.PenpalLegacyFixture = {
    getParentOrigin,
    escapeRegExp,
    connectToParent,
  };
})();
