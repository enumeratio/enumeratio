// Families compiled ahead of time from their Epsil (collections/src/families/
// compiled-families.generated.js) are current. That the compiled code agrees with the
// definitions is each area's own epsil-families test.

import { expect, test } from "vite-plus/test";
import { COMPILED_FAMILIES } from "../collections/src/families/compiled-families.generated.js";
import { compiledFamilies } from "../scripts/compile-families.ts";

test("the compiled module is current (rerun scripts/compile-families.ts)", () => {
  const current = Object.fromEntries(compiledFamilies().map((e) => [e.head, [e.hash, Object.keys(e.code)]]));
  const generated = Object.fromEntries(
    Object.entries(COMPILED_FAMILIES).map(([head, e]) => [
      head,
      [e.hash, Object.keys(e).filter((key) => key !== "hash")],
    ]),
  );
  expect(generated).toEqual(current);
}, 60_000);
