import type * as TC from "./type_classes.ts";
import type { _0, _1 } from "./types.ts";

import * as D from "./derivations.ts";
import { identity } from "./fns.ts";
import { createSequenceStruct, createSequenceTuple } from "./sequence.ts";

/***************************************************************************************************
 * @section Types
 **************************************************************************************************/

export interface State<S, A> {
  (s: S): [A, S];
}

/***************************************************************************************************
 * @section Constructors
 **************************************************************************************************/

export const get: <S>() => State<S, S> = () => (s) => [s, s];

export const put: <S>(s: S) => State<S, void> = (s) => () => [undefined, s];

export const modify: <S>(f: (s: S) => S) => State<S, void> = (f) => (s) => [
  undefined,
  f(s),
];

export const gets: <S, A>(f: (s: S) => A) => State<S, A> = (f) => (s) => [
  f(s),
  s,
];

/***************************************************************************************************
 * @section Modules
 **************************************************************************************************/

export const Functor: TC.Functor<State<_0, _1>, 2> = {
  map: (fab, ta) => (s1) => {
    const [a, s2] = ta(s1);
    return [fab(a), s2];
  },
};

export const Monad: TC.Monad<State<_0, _1>, 2> = {
  of: (a) => (s) => [a, s],
  ap: (tfab, ta) => (s1) => {
    const [f, s2] = tfab(s1);
    const [a, s3] = ta(s2);
    return [f(a), s3];
  },
  map: Functor.map,
  join: (ta) => Monad.chain(identity, ta),
  chain: (fatb, ta) => (s1) => {
    const [a, s2] = ta(s1);
    return fatb(a)(s2);
  },
};

export const Applicative: TC.Applicative<State<_0, _1>, 2> = {
  of: Monad.of,
  ap: Monad.ap,
  map: Functor.map,
};

export const Apply: TC.Apply<State<_0, _1>, 2> = {
  ap: Monad.ap,
  map: Functor.map,
};

/***************************************************************************************************
 * @section Pipeables
 **************************************************************************************************/

export const { of, ap, map, join, chain } = D.createPipeableMonad(Monad);

export const evaluate = <S>(s: S) => <A>(ma: State<S, A>): A => ma(s)[0];

export const execute = <S>(s: S) => <A>(ma: State<S, A>): S => ma(s)[1];

/***************************************************************************************************
 * @section Sequence
 **************************************************************************************************/

export const sequenceTuple = createSequenceTuple(Apply);

export const sequenceStruct = createSequenceStruct(Apply);
