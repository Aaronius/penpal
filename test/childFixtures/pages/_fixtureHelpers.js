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

  const createWindowMessenger = ({ remoteWindow, allowedOrigins } = {}) => {
    const options = {
      remoteWindow: remoteWindow ?? window.parent,
    };

    if (allowedOrigins !== undefined) {
      options.allowedOrigins = allowedOrigins;
    }

    return new Penpal.WindowMessenger(options);
  };

  const connect = ({
    methods,
    allowedOrigins,
    remoteWindow,
    channel,
    logLabel = 'Child',
  } = {}) => {
    const messenger = createWindowMessenger({
      remoteWindow,
      allowedOrigins,
    });

    const options = {
      messenger,
      log: Penpal.debug(logLabel),
    };

    if (methods !== undefined) {
      options.methods = methods;
    }

    if (channel !== undefined) {
      options.channel = channel;
    }

    return Penpal.connect(options);
  };

  window.PenpalFixture = {
    getParentOrigin,
    escapeRegExp,
    connect,
  };
})();
