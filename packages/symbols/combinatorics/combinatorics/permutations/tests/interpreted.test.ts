import { expect, test } from "vite-plus/test";
import { PERMUTATION_STATISTICS } from "../src/statistics.ts";
import { COMPILED } from "../src/statistics.compiled.generated.js";

// The definitions the JavaScript compiler does not lower, which run in the interpreter. A new
// definition that lands here is slower than the rest, so it should be a deliberate addition;
// one that starts compiling should leave the list. A bound value read by `At`, `Count`, `Sum` or
// `Min` needs a `list<…>` type on its `bind`: the default `collection` is not indexable to the compiler.
const INTERPRETED: string[] = [];

// The compiled file is built, and empty until the package's build has run.
test.skipIf(Object.keys(COMPILED).length === 0)(
  "exactly these permutation definitions fall back to the interpreter",
  () => {
    const interpreted = PERMUTATION_STATISTICS.filter((d) => !(`${d.head}@${d.on}` in COMPILED)).map((d) => d.head);
    expect(interpreted.toSorted()).toEqual(INTERPRETED);
  },
);
