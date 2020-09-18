/***************************************************************************************************
 * @section Hole Types
 * @description Marks a type hole to be filled by the substitution ($) type
 **************************************************************************************************/

declare const index: unique symbol;

export interface _<N extends number = 0> {
  [index]: N;
}
export type _0 = _<0>;
export type _1 = _<1>;
export type _2 = _<2>;
export type _3 = _<3>;
export type _4 = _<4>;
export type _5 = _<5>;
export type _6 = _<6>;
export type _7 = _<7>;
export type _8 = _<8>;
export type _9 = _<9>;

/***************************************************************************************************
 * @section Fixed Type
 * @description Fixes a type so it is not replaced by the substitution ($) type
 **************************************************************************************************/

declare const fixed: unique symbol;

export interface Fixed<T> {
  [fixed]: T;
}

/***************************************************************************************************
 * @section Substitution Type
 * @description Replaces any type holes in a type with the supplied parameters
 * @example
 *     type FunctorFn<T> = <A, B>(fab: (a: A) => B, ta: $<T, [A]>) => $<T, [B]>;
 *     type ArrayInstance = FunctorFn<Array<_>>;
 *     // ArrayInstance = <A, B>(fab: (a: A) => B, ta: A[]): B[]
 *     type RecordInstance = FunctorFn<{ value: _ }>;
 *     // RecordInstance = <A, B>(fab: (a: A) => B, ta: { value: A }): { value: B }
 **************************************************************************************************/

// prettier-ignore
export type $<T, S extends any[]> = (
  T extends Fixed<infer U> ? U :
  T extends _<infer N> ? S[N] :
  T extends any[] ? { [K in keyof T]: $<T[K], S> } :
  T extends Promise<infer I> ? Promise<$<I, S>> :
  // T extends (...x: infer I) => (...x: infer J) => infer O ? (...x: $<I, S>) => (...x: $<J, S>) => $<O, S> :
  T extends (...x: infer I) => infer O ? (...x: $<I, S>) => $<O, S> :
  T extends object ? { [K in keyof T]: $<T[K], S> } :
  T extends undefined | null | boolean | string | number ? T :
  T
);
