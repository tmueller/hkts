import type * as TC from "./type_classes.ts";
import type { $, _ } from "./types.ts";

import * as D from "./derivations.ts";
import { createSequenceStruct, createSequenceTuple } from "./sequence.ts";

/***************************************************************************************************
 * @section Optimizations
 **************************************************************************************************/

export const _map = <A, B>(
  as: ReadonlyArray<A>,
  fab: (a: A, i: number) => B,
): ReadonlyArray<B> => {
  const out: B[] = new Array(as.length);
  for (let i = 0; i < as.length; i++) {
    out[i] = fab(as[i], i);
  }
  return out;
};

export const _reduce = <A, B>(
  as: ReadonlyArray<A>,
  fbab: (b: B, a: A, i: number) => B,
  b: B,
): B => {
  let out = b;
  for (let i = 0; i < as.length; i++) {
    out = fbab(out, as[i], i);
  }
  return out;
};

const _concat = <A>(
  a: ReadonlyArray<A>,
  b: ReadonlyArray<A>,
): ReadonlyArray<A> => {
  if (a.length === 0) {
    return b;
  }

  if (b.length === 0) {
    return a;
  }

  const result = Array(a.length + b.length);

  for (let i = 0; i < a.length; i++) {
    result[i] = a[i];
  }

  for (let i = 0; i < b.length; i++) {
    result[i + a.length] = b[i];
  }
  return result;
};

/***************************************************************************************************
 * @section Constructors
 **************************************************************************************************/

export const zero: ReadonlyArray<never> = [];

export const empty = <A = never>(): ReadonlyArray<A> => zero;

/***************************************************************************************************
 * @section Module Getters
 **************************************************************************************************/

export const getShow = <A>({ show }: TC.Show<A>): TC.Show<readonly A[]> => ({
  show: (ta) => `ReadonlyArray[${ta.map(show).join(", ")}]`,
});

export const getMonoid = <A = never>(): TC.Monoid<ReadonlyArray<A>> => ({
  empty,
  concat: _concat,
});

/***************************************************************************************************
 * @section Modules
 **************************************************************************************************/

export const Functor: TC.Functor<ReadonlyArray<_>> = {
  map: (fab, ta) => _map(ta, (a) => fab(a)),
};

export const Monad: TC.Monad<ReadonlyArray<_>> = {
  of: (a) => [a],
  ap: (tfab, ta) => Monad.chain((f) => Monad.map(f, ta), tfab),
  map: (fab, ta) => _map(ta, (a) => fab(a)),
  join: (tta) => tta.flat(1),
  chain: (fatb, ta) =>
    _reduce(ta, (bs: readonly any[], a) => _concat(bs, fatb(a)), []),
};

export const Filterable: TC.Filterable<ReadonlyArray<_>> = {
  filter: (predicate, ta) => ta.filter(predicate),
};

export const Apply: TC.Apply<ReadonlyArray<_>> = {
  ap: Monad.ap,
  map: Functor.map,
};

export const IndexedFoldable: TC.IndexedFoldable<ReadonlyArray<_>> = {
  reduce: (faba, a, tb) => _reduce(tb, faba, a),
};

export const IndexedTraversable: TC.IndexedTraversable<ReadonlyArray<_>> = {
  map: Monad.map,
  reduce: IndexedFoldable.reduce,
  traverse: <U, A, B>(
    A: TC.Applicative<U>,
    faub: (a: A, i: number) => $<U, [B]>,
    ta: ReadonlyArray<A>,
  ) =>
    IndexedFoldable.reduce(
      (fbs, a, i) =>
        A.ap(
          A.map((bs) =>
            (b: B) => {
              bs.push(b);
              return bs;
            }, fbs),
          faub(a, i),
        ),
      A.of([] as B[]),
      ta,
    ),
};

export const Foldable: TC.Foldable<ReadonlyArray<_>> = IndexedFoldable;

export const Traversable: TC.Traversable<ReadonlyArray<_>> = IndexedTraversable;

/***************************************************************************************************
 * @section Pipeables
 **************************************************************************************************/

export const { of, ap, map, join, chain } = D.createPipeableMonad(Monad);

export const { reduce, traverse } = D.createPipeableTraversable(Traversable);

export const {
  traverse: indexedTraverse,
  reduce: indexedReduce,
  map: indexedMap,
}: TC.IndexedTraversableP<ReadonlyArray<_>> = {
  map: (fab) => (ta) => _map(ta, fab),
  reduce: (faba, a) => (tb) => _reduce(tb, faba, a),
  traverse: <U>(A: TC.Applicative<U>) =>
    <A, B>(faUb: (a: A, i: number) => $<U, [B]>) =>
      (ta: readonly A[]) => IndexedTraversable.traverse(A, faUb, ta),
};

/***************************************************************************************************
 * @section Sequence
 **************************************************************************************************/

export const sequenceTuple = createSequenceTuple(Apply);

export const sequenceStruct = createSequenceStruct(Apply);
