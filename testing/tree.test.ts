import { assertMonad } from "./assert.ts";

import * as T from "../tree.ts";

const toString = (n: number): string => n.toString();
const toLength = (s: string): number => s.length;
const fromNumber = (n: number) => T.of(n.toString());
const fromString = (s: string) => T.of(s.length);

Deno.test({
  name: "Tree Modules",
  async fn() {
    await assertMonad(
      T.Monad,
      "Tree",
      {
        a: 1,
        ta: T.of(1),
        fab: toString,
        fbc: toLength,
        tfab: T.of(toString),
        tfbc: T.of(toLength),
        fatb: fromNumber,
        fbtc: fromString,
      },
    );
  },
});
