(() => {
  const root = typeof self !== 'undefined' ? self : window;

  const createBaseMethods = ({
    getParentApi,
    setParentReturnValue,
    getParentReturnValue,
    getUnclonableValue,
    createReply,
  }) => {
    return {
      multiply(num1, num2) {
        return num1 * num2;
      },
      multiplyAsync(num1, num2) {
        return Promise.resolve(num1 * num2);
      },
      double(numbersArray) {
        const resultArray = numbersArray.map((num) => num * 2);
        return createReply(resultArray, {
          transferables: [resultArray.buffer],
        });
      },
      multiplyWithPromisedReplyInstanceAndPromisedReturnValue(num1, num2) {
        return Promise.resolve(createReply(Promise.resolve(num1 * num2)));
      },
      addUsingParent() {
        return Promise.resolve(getParentApi())
          .then((parentApi) => parentApi.add(3, 6))
          .then((value) => {
            setParentReturnValue(value);
          });
      },
      getParentReturnValue() {
        return getParentReturnValue();
      },
      getPromiseRejectedWithString() {
        return Promise.reject('test error string');
      },
      getPromiseRejectedWithObject() {
        return Promise.reject({ a: 'b' });
      },
      getPromiseRejectedWithUndefined() {
        return Promise.reject();
      },
      getPromiseRejectedWithError() {
        // Using TypeError instead of Error to ensure error name serialization.
        return Promise.reject(new TypeError('test error object'));
      },
      throwError() {
        throw new Error('Oh nos!');
      },
      getUnclonableValue() {
        return getUnclonableValue();
      },
      apply() {
        return 'apply result';
      },
      call() {
        return 'call result';
      },
      bind() {
        return 'bind result';
      },
      nested: {
        oneLevel(input) {
          return input;
        },
        by: {
          twoLevels(input) {
            return input;
          },
        },
        apply() {
          return 'apply result';
        },
      },
      neverResolve() {
        return new Promise(() => {
          // Intentionally never resolves.
        });
      },
      ['with.period']() {
        return 'success';
      },
    };
  };

  const createGeneralMethods = ({
    getParentApi,
    setParentReturnValue,
    getParentReturnValue,
    getUnclonableValue,
    createReply,
    reload,
    navigate,
  }) => {
    const methods = createBaseMethods({
      getParentApi,
      setParentReturnValue,
      getParentReturnValue,
      getUnclonableValue,
      createReply,
    });

    if (reload) {
      methods.reload = () => {
        reload();
      };
    }

    if (navigate) {
      methods.navigate = (to) => {
        navigate(to);
      };
    }

    return methods;
  };

  const createParentRoundTripMethods = ({
    getParentApi,
    setParentReturnValue,
    getParentReturnValue,
  }) => {
    return {
      multiply(num1, num2) {
        return num1 * num2;
      },
      addUsingParent() {
        return Promise.resolve(getParentApi())
          .then((parentApi) => parentApi.add(3, 6))
          .then((value) => {
            setParentReturnValue(value);
          });
      },
      getParentReturnValue() {
        return getParentReturnValue();
      },
    };
  };

  root.PenpalGeneralFixtureMethods = {
    createGeneralMethods,
    createParentRoundTripMethods,
  };
})();
