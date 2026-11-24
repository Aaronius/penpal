import { expectTypeOf } from 'vitest';
import { CallOptions, type RemoteProxy } from '../../src/index.js';

type ChildMethods = {
  multiply(a: number, b: number): number;
  ['with.period'](): 'success';
  apply(): 'apply result';
  call(): 'call result';
  bind(): 'bind result';
  then(): string;
  toJSON(): string;
  search(query?: string, limit?: number): string[];
  sum(...values: number[]): number;
  sumWithLabel(label?: string, ...values: number[]): number;
  nested: {
    apply(): 'nested apply';
    call(): string;
    bind(): string;
    then(): string;
    toJSON(): string;
    oneLevel(input: number): number;
  };
};

declare const child: RemoteProxy<ChildMethods>;

expectTypeOf(child.multiply(2, 3)).toEqualTypeOf<Promise<number>>();
expectTypeOf(
  child.multiply(2, 3, new CallOptions({ timeout: 123 })),
).toEqualTypeOf<Promise<number>>();

expectTypeOf(child['with.period']()).toEqualTypeOf<Promise<'success'>>();
expectTypeOf(child.apply()).toEqualTypeOf<Promise<'apply result'>>();
expectTypeOf(child.call()).toEqualTypeOf<Promise<'call result'>>();
expectTypeOf(child.bind()).toEqualTypeOf<Promise<'bind result'>>();
expectTypeOf(child.nested.oneLevel(2)).toEqualTypeOf<Promise<number>>();
expectTypeOf(child.then).toBeUndefined();
expectTypeOf(child.toJSON).toBeUndefined();
expectTypeOf(child.nested.then).toBeUndefined();
expectTypeOf(child.nested.toJSON).toBeUndefined();
expectTypeOf(child.nested.apply).toBeNever();
expectTypeOf(child.nested.call).toBeNever();
expectTypeOf(child.nested.bind).toBeNever();

declare const untyped: RemoteProxy;
expectTypeOf(untyped.save!.bind).toEqualTypeOf<Function['bind']>();

declare const dictionary: RemoteProxy<{
  nested: Record<string, () => string>;
}>;
expectTypeOf(dictionary.nested.lookup!()).toEqualTypeOf<Promise<string>>();
expectTypeOf(dictionary.nested.apply).toBeUndefined();
expectTypeOf(dictionary.nested.call).toBeUndefined();
expectTypeOf(dictionary.nested.bind).toBeUndefined();

const options = new CallOptions({ timeout: 1000 });
expectTypeOf(child.multiply(2, 3, undefined)).toEqualTypeOf<Promise<number>>();
expectTypeOf(child.search('Penpal', undefined, options)).toEqualTypeOf<
  Promise<string[]>
>();
expectTypeOf(child.search(undefined, undefined, options)).toEqualTypeOf<
  Promise<string[]>
>();
expectTypeOf(child.search(undefined, 5, options)).toEqualTypeOf<
  Promise<string[]>
>();
expectTypeOf(child.sum(1, 2, options)).toEqualTypeOf<Promise<number>>();
expectTypeOf(child.sum(options)).toEqualTypeOf<Promise<number>>();
expectTypeOf(child.sumWithLabel(undefined, options)).toEqualTypeOf<
  Promise<number>
>();
expectTypeOf(child.sumWithLabel(undefined, 1, options)).toEqualTypeOf<
  Promise<number>
>();

// @ts-expect-error A rest parameter does not allow CallOptions in the middle.
void child.sum(1, options, 2);
// @ts-expect-error Required positional parameters cannot be omitted.
void child.multiply(options);
// @ts-expect-error CallOptions must be the final argument.
void child.multiply(new CallOptions(), 2, 3);
// @ts-expect-error Method with period accepts no arguments.
void child['with.period']('unexpected arg');
