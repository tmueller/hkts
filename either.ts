import type * as TC from "./type_classes.ts";
import type { $, _0, _1, _2, _3 } from "./hkts.ts";

import { createSequenceStruct, createSequenceTuple } from "./sequence.ts";
import { isNotNil, Lazy, Predicate, Refinement } from "./fns.ts";
import * as D from "./derivations.ts";

/***************************************************************************************************
 * @section Types
 **************************************************************************************************/

export type Left<L> = { tag: "Left"; left: L };
export type Right<R> = { tag: "Right"; right: R };
export type Either<L, R> = Left<L> | Right<R>;

/***************************************************************************************************
 * @section Constructors
 **************************************************************************************************/

export const left = <E = never, A = never>(left: E): Either<E, A> => ({
  tag: "Left",
  left,
});
export const right = <E = never, A = never>(right: A): Either<E, A> => ({
  tag: "Right",
  right,
});

export function fromNullable<E>(e: E): <A>(a: A) => Either<E, NonNullable<A>> {
  return <A>(a: A) => (isNotNil(a) ? right(a) : left(e));
}

export function tryCatch<E, A>(
  f: Lazy<A>,
  onError: (e: unknown) => E,
): Either<E, A> {
  try {
    return right(f());
  } catch (e) {
    return left(onError(e));
  }
}

export const fromPredicate: {
  <E, A, B extends A>(refinement: Refinement<A, B>, onFalse: (a: A) => E): (
    a: A,
  ) => Either<E, B>;
  <E, A>(predicate: Predicate<A>, onFalse: (a: A) => E): (a: A) => Either<E, A>;
} = <E, A>(predicate: Predicate<A>, onFalse: (a: A) => E) =>
  (a: A) => predicate(a) ? right(a) : left(onFalse(a));

/***************************************************************************************************
 * @section Destructors
 **************************************************************************************************/

export const fold = <L, R, B>(
  onLeft: (left: L) => B,
  onRight: (right: R) => B,
) => (ma: Either<L, R>): B => isLeft(ma) ? onLeft(ma.left) : onRight(ma.right);

export const getOrElse = <E, A>(onLeft: (e: E) => A) =>
  (ma: Either<E, A>): A => isLeft(ma) ? onLeft(ma.left) : ma.right;

/***************************************************************************************************
 * @section Combinators
 **************************************************************************************************/

export const swap = <E, A>(ma: Either<E, A>): Either<A, E> =>
  isLeft(ma) ? right(ma.left) : left(ma.right);

export const orElse = <E, A, M>(onLeft: (e: E) => Either<M, A>) =>
  (
    ma: Either<E, A>,
  ): Either<M, A> => (isLeft(ma) ? onLeft(ma.left) : ma);

/***************************************************************************************************
 * @section Guards
 **************************************************************************************************/

export const isLeft = <L, R>(m: Either<L, R>): m is Left<L> => m.tag === "Left";
export const isRight = <L, R>(m: Either<L, R>): m is Right<R> =>
  m.tag === "Right";

/***************************************************************************************************
 * @section Module Getters
 **************************************************************************************************/

export const getShow = <E, A>(
  SE: TC.Show<E>,
  SA: TC.Show<A>,
): TC.Show<Either<E, A>> => ({
  show: fold(
    (left) => `Left(${SE.show(left)})`,
    (right) => `Right(${SA.show(right)})`,
  ),
});

export const getSemigroup = <E, A>(
  SE: TC.Semigroup<E>,
  SA: TC.Semigroup<A>,
): TC.Semigroup<Either<E, A>> => ({
  concat: (x, y) => {
    if (isLeft(x)) {
      if (isLeft(y)) {
        return left(SE.concat(x.left, y.left));
      }
      return y;
    }

    if (isLeft(y)) {
      return x;
    }
    return right(SA.concat(x.right, y.right));
  },
});

/***************************************************************************************************
 * @section Modules
 **************************************************************************************************/

export const Functor: TC.Functor<Either<_0, _1>, 2> = {
  map: (fab, ta) => isLeft(ta) ? ta : right(fab(ta.right)),
};

export const Bifunctor: TC.Bifunctor<Either<_0, _1>> = {
  bimap: (fab, fcd, tac) =>
    isLeft(tac) ? left(fab(tac.left)) : right(fcd(tac.right)),
};

export const Monad = D.createMonad<Either<_0, _1>, 2>({
  of: right,
  chain: (fatb, ta) => (isRight(ta) ? fatb(ta.right) : ta),
});

export const Applicative: TC.Applicative<Either<_0, _1>, 2> = {
  of: Monad.of,
  ap: Monad.ap,
  map: Functor.map,
};

export const Apply: TC.Apply<Either<_0, _1>, 2> = {
  ap: Monad.ap,
  map: Functor.map,
};

export const Foldable: TC.Foldable<Either<_0, _1>, 2> = {
  reduce: (faba, a, tb) => (isRight(tb) ? faba(a, tb.right) : a),
};

export const Traversable: TC.Traversable<Either<_0, _1>, 2> = {
  map: Functor.map,
  reduce: Foldable.reduce,
  traverse: (F, faub, ta) =>
    isLeft(ta) ? F.of(left(ta.left)) : F.map(right, faub(ta.right)),
};

/***************************************************************************************************
 * @section Transformers
 **************************************************************************************************/

type GetEitherMonad = {
  <T, L extends 1>(M: TC.Monad<T, L>): TC.Monad<$<T, [Either<_0, _1>]>, 2>;
  <T, L extends 2>(M: TC.Monad<T, L>): TC.Monad<$<T, [Either<_1, _2>]>, 3>;
};

/**
 * This is an experimental interface. Ideally, the substitution type would handle this
 * a bit better so we wouldn't have to do unsafe coercion.
 * @experimental
 */
export const getEitherM: GetEitherMonad = <T>(M: TC.Monad<T>) =>
  D.createMonad<$<T, [Either<_0, _1>]>, 2>({
    of: (a) => M.of(right(a)) as any,
    chain: (fatb: any, ta: any) =>
      M.chain(
        (e: any) => (isLeft(e) ? M.of(left(e.left)) : fatb(e.right)),
        ta,
      ) as any,
  }) as any;

/***************************************************************************************************
 * @section Pipeables
 **************************************************************************************************/

export const { of, ap, map, join, chain } = D.createPipeableMonad(Monad);

export const { reduce, traverse } = D.createPipeableTraversable(Traversable);

export const { bimap } = D.createPipeableBifunctor(Bifunctor);

/***************************************************************************************************
 * @section Sequence
 **************************************************************************************************/

export const sequenceTuple = createSequenceTuple(Apply);

export const sequenceStruct = createSequenceStruct(Apply);
