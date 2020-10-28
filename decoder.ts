import type { _, _0, _1, Refinement } from "./types.ts";
import type * as TC from "./type_classes.ts";

import * as S from "./schemable.ts";
import * as G from "./guard.ts";
import * as E from "./either.ts";
import * as T from "./tree.ts";
import * as A from "./array.ts";
import * as R from "./record.ts";
import * as DE from "./decode_error.ts";
import * as FS from "./free_semigroup.ts";
import { createPipeableMonad } from "./derivations.ts";
import {
  flow,
  identity,
  intersect as _intersect,
  memoize,
  pipe,
} from "./fns.ts";

/***************************************************************************************************
 * @section Types
 **************************************************************************************************/

export interface Decoder<I, A> {
  readonly decode: (i: I) => Decoded<A>;
}

export type DecodeError = FS.FreeSemigroup<DE.DecodeError<string>>;

export type Decoded<A> = E.Either<DecodeError, A>;

export type InputOf<D> = D extends Decoder<infer I, infer _> ? I : never;

export type TypeOf<D> = D extends Decoder<infer _, infer A> ? A : never;

/***************************************************************************************************
 * @section Modules
 **************************************************************************************************/

const Monad = E.getRightMonad(DE.getSemigroup<string>());

const Applicative: TC.Applicative<Decoded<_>> = {
  of: Monad.of,
  ap: Monad.ap,
  map: Monad.map,
};

const Alt: TC.Alt<Decoded<_>> = E.Alt;

/***************************************************************************************************
 * @section Module Pipeables
 **************************************************************************************************/

const { chain } = createPipeableMonad(Monad);

const traverseRecord = R.indexedTraverse(Applicative);

const traverseArray = A.indexedTraverse(Applicative);

/***************************************************************************************************
 * @section DecodeError Constructors
 **************************************************************************************************/

export const error = (actual: unknown, message: string): DecodeError =>
  FS.of(DE.leaf(actual, message));

export const success: <A>(a: A) => Decoded<A> = E.right;

export const failure = <A = never>(
  actual: unknown,
  message: string,
): Decoded<A> => E.left(error(actual, message));

/***************************************************************************************************
 * @section Constructors
 **************************************************************************************************/

export const fromRefinement = <I, A extends I>(
  refinement: Refinement<I, A>,
  expected: string,
): Decoder<I, A> => ({
  decode: (i) => refinement(i) ? success(i) : failure(i, expected),
});

export const fromGuard = <I, A extends I>(
  guard: G.Guard<I, A>,
  expected: string,
): Decoder<I, A> => fromRefinement(guard.is, expected);

/***************************************************************************************************
 * @section Utilities
 **************************************************************************************************/

const toTree: (e: DE.DecodeError<string>) => T.Tree<string> = DE.fold({
  Leaf: (input, error) =>
    T.make(`cannot decode ${JSON.stringify(input)}, should be ${error}`),
  Key: (key, kind, errors) =>
    T.make(`${kind} property ${JSON.stringify(key)}`, toForest(errors)),
  Index: (index, kind, errors) =>
    T.make(`${kind} index ${index}`, toForest(errors)),
  Member: (index, errors) => T.make(`member ${index}`, toForest(errors)),
  Lazy: (id, errors) => T.make(`lazy type ${id}`, toForest(errors)),
  Wrap: (error, errors) => T.make(error, toForest(errors)),
});

const toForest: (e: DecodeError) => ReadonlyArray<T.Tree<string>> = FS.fold(
  (value) => [toTree(value)],
  (left, right) => toForest(left).concat(toForest(right)),
);

/***************************************************************************************************
 * @section Combinators
 **************************************************************************************************/

export const draw = (e: DecodeError): string =>
  toForest(e).map(T.drawTree).join("\n");

export const stringify: <A>(e: E.Either<DecodeError, A>) => string = E.fold(
  draw,
  (a) => JSON.stringify(a, null, 2),
);

export const mapLeftWithInput = <I>(
  f: (input: I, e: DecodeError) => DecodeError,
) =>
  <A>(decoder: Decoder<I, A>): Decoder<I, A> => ({
    decode: (i) => E.Bifunctor.mapLeft((e) => f(i, e), decoder.decode(i)),
  });

export const withMessage = <I>(
  message: (input: I, e: DecodeError) => string,
): (<A>(decoder: Decoder<I, A>) => Decoder<I, A>) =>
  mapLeftWithInput((input, e) => FS.of(DE.wrap(message(input, e), e)));

export const refine = <A, B extends A>(
  refinement: (a: A) => a is B,
  id: string,
) =>
  <I>(from: Decoder<I, A>): Decoder<I, B> => ({
    decode: (i) =>
      pipe(
        from.decode(i),
        E.chain((a) => refinement(a) ? success(a) : failure(i, id)),
      ),
  });

export const nullable = <I, A>(
  or: Decoder<I, A>,
): Decoder<null | I, null | A> => ({
  decode: (i) =>
    i === null ? E.right(i as A | null) : E.Bifunctor.mapLeft(
      (e) => FS.concat(FS.of(DE.member(0, error(i, "null"))), e),
      or.decode(i),
    ),
});

export const undefinable = <I, A>(
  or: Decoder<I, A>,
): Decoder<undefined | I, undefined | A> => ({
  decode: (i) =>
    i === undefined ? E.right(i as A | undefined) : E.Bifunctor.mapLeft(
      (e) => FS.concat(e, FS.of(DE.leaf(i, "undefined"))),
      or.decode(i),
    ),
});

/***************************************************************************************************
 * @section Schemables
 **************************************************************************************************/

export const literal = <A extends readonly [S.Literal, ...S.Literal[]]>(
  ...values: A
): Decoder<unknown, A[number]> => {
  const is = G.literal(...values).is;
  const expected = values.map((value) => JSON.stringify(value)).join(" | ");
  return ({
    decode: (i) => is(i) ? success(i) : failure(i, expected),
  });
};

export const string = fromGuard(G.string, "string");

export const number = fromGuard(G.number, "number");

export const boolean = fromGuard(G.boolean, "boolean");

export const unknownArray = fromGuard(G.unknownArray, "unknownArray");

export const unknownRecord = fromGuard(G.unknownRecord, "unknownRecord");

export const type = <P extends Record<string, Decoder<unknown, unknown>>>(
  properties: P,
): Decoder<
  unknown,
  { [K in keyof P]: TypeOf<P[K]> }
> =>
  ({
    decode: flow(
      unknownRecord.decode,
      chain((r) =>
        pipe(
          properties,
          traverseRecord(
            ({ decode }, key) =>
              E.Bifunctor.mapLeft(
                (e) => FS.of(DE.key(key, DE.required, e)),
                decode(r[key]),
              ),
          ),
        )
      ),
    ),
  }) as Decoder<unknown, { [K in keyof P]: TypeOf<P[K]> }>;

export const partial = <P extends Record<string, Decoder<unknown, unknown>>>(
  properties: P,
): Decoder<unknown, Partial<{ [K in keyof P]: TypeOf<P[K]> }>> =>
  ({
    decode: flow(
      unknownRecord.decode,
      chain((r) =>
        pipe(
          properties,
          traverseRecord(
            (decoder, key) =>
              E.Bifunctor.mapLeft(
                (e) => FS.of(DE.key(key, DE.required, e)),
                undefinable(decoder).decode(r[key]),
              ),
          ),
        )
      ),
    ),
  }) as Decoder<unknown, Partial<{ [K in keyof P]: TypeOf<P[K]> }>>;

export const array = <A>(
  item: Decoder<unknown, A>,
): Decoder<unknown, A[]> =>
  ({
    decode: flow(
      unknownArray.decode,
      chain(
        traverseArray(
          (a, i) =>
            E.Bifunctor.mapLeft(
              (e) => FS.of(DE.index(i, DE.optional, e)),
              item.decode(a),
            ),
        ),
      ),
    ),
  }) as Decoder<unknown, A[]>;

export const record = <A>(
  { decode }: Decoder<unknown, A>,
): Decoder<unknown, Record<string, A>> =>
  ({
    decode: flow(
      unknownRecord.decode,
      chain(
        traverseRecord(
          (value: unknown, key) =>
            E.Bifunctor.mapLeft(
              (e) => FS.of(DE.key(key, DE.required, e)),
              decode(value),
            ),
        ),
      ),
    ),
  }) as Decoder<unknown, Record<string, A>>;

export const tuple = <A extends ReadonlyArray<unknown>>(
  ...components: { [K in keyof A]: Decoder<unknown, A[K]> }
): Decoder<unknown, A> =>
  ({
    decode: (i) =>
      pipe(
        unknownArray.decode(i),
        chain((as) =>
          pipe(
            components,
            traverseArray(
              ({ decode }, i) =>
                E.Bifunctor.mapLeft(
                  (e) => FS.of(DE.index(i, DE.required, e)),
                  decode(as[i]),
                ),
            ),
          )
        ),
      ),
  }) as Decoder<unknown, A>;

export const union = <
  MS extends readonly [
    Decoder<unknown, unknown>,
    ...Array<Decoder<unknown, unknown>>,
  ],
>(
  ...members: MS
): Decoder<InputOf<MS[keyof MS]>, TypeOf<MS[keyof MS]>> => ({
  decode: (i) => {
    let out = E.Bifunctor.mapLeft(
      (e) => FS.of(DE.member(0, e)),
      members[0].decode(i),
    ) as Decoded<TypeOf<MS[keyof MS]>>;
    for (let index = 1; index < members.length; index++) {
      out = Alt.alt(
        out,
        E.Bifunctor.mapLeft(
          (e) => FS.of(DE.member(index, e)),
          members[index].decode(i),
        ),
      ) as Decoded<TypeOf<MS[keyof MS]>>;
    }
    return out;
  },
});

export const intersect = <IA, A, IB, B>(
  left: Decoder<IA, A>,
  right: Decoder<IB, B>,
): Decoder<IA & IB, A & B> => ({
  decode: (i) =>
    Monad.ap(
      Monad.map((a: A) => (b: B) => _intersect(a, b), left.decode(i)),
      right.decode(i),
    ),
});

export const sum = <T extends string, A>(
  tag: T,
  members: { [K in keyof A]: Decoder<unknown, A[K]> },
): Decoder<unknown, A[keyof A]> => {
  const keys = Object.keys(members);
  return ({
    decode: flow(
      unknownRecord.decode,
      chain((ir) => {
        const v = ir[tag];
        if (typeof v === "string" && v in members) {
          return members[v as keyof A].decode(ir);
        }
        return E.left(FS.of(
          DE.key(
            tag,
            DE.required,
            error(
              v,
              keys.length === 0
                ? "never"
                : keys.map((k) => JSON.stringify(k)).join(" | "),
            ),
          ),
        ));
      }),
    ),
  });
};

export const lazy = <I, A>(
  id: string,
  f: () => Decoder<I, A>,
): Decoder<I, A> => {
  const get = memoize<void, Decoder<I, A>>(f);
  return ({
    decode: flow(
      get().decode,
      E.mapLeft((e) => FS.of(DE.lazy(id, e))),
    ),
  });
};

/***************************************************************************************************
 * @section Modules
 **************************************************************************************************/

export const Schemable: S.Schemable<Decoder<unknown, _>> = {
  literal,
  string: () => string,
  number: () => number,
  boolean: () => boolean,
  nullable: nullable,
  type,
  partial,
  record,
  array,
  tuple: tuple as S.TupleSchemable<Decoder<unknown, _>, 1>,
  intersect,
  sum,
  lazy,
};

export const Category: TC.Category<Decoder<_0, _1>> = {
  compose: (tij, tjk) => ({ decode: flow(tij.decode, chain(tjk.decode)) }),
  id: () => ({ decode: identity }),
};
