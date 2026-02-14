import { expectTypeOf } from 'vitest';
import { RemoteProxy } from '../../src/index.js';

type ChildMethods = {
  multiply(a: number, b: number): number;
  multiplyAsync(a: number, b: number): Promise<number>;
  nested: {
    oneLevel(input: string): string;
    by: {
      twoLevels(input: string): string;
    };
  };
};

declare const child: RemoteProxy<ChildMethods>;

expectTypeOf(child.multiply(2, 3)).toEqualTypeOf<Promise<number>>();
expectTypeOf(child.multiplyAsync(2, 3)).toEqualTypeOf<Promise<number>>();
expectTypeOf(child.nested.oneLevel('penpal')).toEqualTypeOf<Promise<string>>();
expectTypeOf(child.nested.by.twoLevels('penpal')).toEqualTypeOf<
  Promise<string>
>();

// @ts-expect-error Child multiply requires two number arguments.
void child.multiply('2', 3);
// @ts-expect-error Nested method should not accept a number argument.
void child.nested.by.twoLevels(7);
