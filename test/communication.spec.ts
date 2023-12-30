import { createIframeAndConnection, createWorkerAndConnection } from './utils';

const variants = [
  {
    childType: 'iframe',
    createConnection: createIframeAndConnection,
  },
  {
    childType: 'worker',
    createConnection: createWorkerAndConnection,
  },
];

for (const variant of variants) {
  const { childType, createConnection } = variant;

  describe(`communication between parent and child ${childType}`, () => {
    it('calls a function on the child', async () => {
      const connection = createConnection();
      const child = await connection.promise;
      // @ts-expect-error
      const value = await child.multiply(2, 5);
      expect(value).toEqual(10);
      connection.destroy();
    });

    it('calls a function on the child', async () => {
      const connection = createConnection();
      const child = await connection.promise;
      // @ts-expect-error
      const value = await child.multiply(2, 5);
      expect(value).toEqual(10);
      connection.destroy();
    });

    it('calls nested functions on the child', async () => {
      const connection = createConnection();
      const child = await connection.promise;
      // @ts-expect-error
      const oneLevel = await child.nested.oneLevel('pen');
      expect(oneLevel).toEqual('pen');
      // @ts-expect-error
      const twoLevels = await child.nested.by.twoLevels('pal');
      expect(twoLevels).toEqual('pal');
      connection.destroy();
    });

    it('calls an asynchronous function on the child', async () => {
      const connection = createConnection();
      const child = await connection.promise;
      // @ts-expect-error
      const value = await child.multiply(2, 5);
      expect(value).toEqual(10);
      connection.destroy();
    });

    it('calls a function on the parent', async () => {
      const connection = createConnection({
        methods: {
          add: (num1: number, num2: number) => {
            return num1 + num2;
          },
        },
      });
      const child = await connection.promise;
      // @ts-expect-error
      await child.addUsingParent();
      // @ts-expect-error
      const value = await child.getParentReturnValue();
      expect(value).toEqual(9);
      connection.destroy();
    });

    it('handles promises rejected with strings', async () => {
      const connection = createConnection();
      const child = await connection.promise;
      // @ts-expect-error
      await expectAsync(child.getRejectedPromiseString()).toBeRejectedWith(
        'test error string'
      );
      connection.destroy();
    });

    it('handles promises rejected with error objects', async () => {
      const connection = createConnection();
      const child = await connection.promise;
      let error;
      try {
        // @ts-expect-error
        await child.getRejectedPromiseError();
      } catch (e) {
        error = e;
      }
      expect(error).toEqual(jasmine.any(Error));
      expect(error.name).toBe('TypeError');
      expect(error.message).toBe('test error object');
      expect(error.stack).toEqual(jasmine.any(String));
      connection.destroy();
    });

    it('handles thrown errors', async () => {
      const connection = createConnection();
      const child = await connection.promise;
      let error;
      try {
        // @ts-expect-error
        await child.throwError();
      } catch (e) {
        error = e;
      }
      expect(error).toEqual(jasmine.any(Error));
      expect(error.message).toBe('Oh nos!');
      connection.destroy();
    });

    it('handles unclonable values', async () => {
      const connection = createConnection();
      const child = await connection.promise;
      let error;
      try {
        // @ts-expect-error
        await child.getUnclonableValue();
      } catch (e) {
        error = e;
      }
      expect(error).toEqual(jasmine.any(Error));
      expect(error.name).toBe('DataCloneError');
      connection.destroy();
    });
  });
}
