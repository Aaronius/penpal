import { expectTypeOf } from 'vitest';
import { CallOptions, RemoteProxy } from '../../src/index.js';

type ChildMethods = {
  multiply(a: number, b: number): number;
  ['with.period'](): 'success';
  apply(): 'apply result';
  call(): 'call result';
  bind(): 'bind result';
  nested: {
    apply(): 'nested apply';
    oneLevel(input: number): number;
  };
};

declare const child: RemoteProxy<ChildMethods>;

expectTypeOf(child.multiply(2, 3)).toEqualTypeOf<Promise<number>>();
expectTypeOf(
  child.multiply(2, 3, new CallOptions({ timeout: 123 }))
).toEqualTypeOf<Promise<number>>();

expectTypeOf(child['with.period']()).toEqualTypeOf<Promise<'success'>>();
expectTypeOf(child.apply()).toEqualTypeOf<Promise<'apply result'>>();
expectTypeOf(child.call()).toEqualTypeOf<Promise<'call result'>>();
expectTypeOf(child.bind()).toEqualTypeOf<Promise<'bind result'>>();
expectTypeOf(child.nested.apply()).toEqualTypeOf<Promise<'nested apply'>>();
expectTypeOf(child.nested.oneLevel(2)).toEqualTypeOf<Promise<number>>();

// @ts-expect-error CallOptions must be the final argument.
void child.multiply(new CallOptions(), 2, 3);
// @ts-expect-error Method with period accepts no arguments.
void child['with.period']('unexpected arg');
