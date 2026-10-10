// Checks `@enumeratio/oracle`'s built `defined-names-data.ts` (collect-defined-names.ts) is what
// the records and engine give now: every
// bare symbol used anywhere in a reference example, for which the fully-declared reference
// engine (engines.ts's `declaredEngine`) has a definition. `emit.ts` uses this set to decide
// whether a bare symbol is a free variable (undefined — carry it through symbolically) or a
// known name (a domain, a constant, a head passed as a value) it shouldn't guess a value for;
// it runs in the browser too, so it reads the generated set rather than holding a live engine.
//
// A stale build (oracle's `build` not rerun after a records change) is what fails this test.

import { DEFINED_NAMES, type MathJSON } from "@enumeratio/oracle";
import { expect, test } from "vite-plus/test";
import { declaredEngine } from "../scripts/engines.ts";
import { isDefinedName, symbolsIn } from "../scripts/defined-names.ts";
import { referenceData, referenceEntries } from "../src/node.ts";

test("the built defined-names-data.ts matches the records", () => {
  const data = referenceData();
  const names = new Set<string>();
  for (const entry of referenceEntries(data)) {
    for (const example of entry.examples) {
      symbolsIn(example.expr as MathJSON, names);
      symbolsIn(example.expected as MathJSON, names);
    }
  }
  const ce = declaredEngine({ graphics: false });
  const defined = [...names].filter((name) => isDefinedName(ce, name)).toSorted();
  expect(defined, "rebuild: pnpm --filter @enumeratio/oracle run build").toEqual([...DEFINED_NAMES].toSorted());
}, 60_000); // walks every reference example and boxes every symbol through the full engine
