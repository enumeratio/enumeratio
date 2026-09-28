// Pins `@enumeratio/oracle`'s `defined-names-data.ts` current (collect-defined-names.ts): every
// bare symbol used anywhere in a reference example, for which the fully-declared reference
// engine (engines.ts's `declaredEngine`) has a definition. `emit.ts` uses this set to decide
// whether a bare symbol is a free variable (undefined — carry it through symbolically) or a
// known name (a domain, a constant, a head passed as a value) it shouldn't guess a value for;
// it runs in the browser too, so it reads the generated set rather than holding a live engine.
//
// A reference example that introduces a genuinely new symbol name is exactly what should fail
// this test — regenerate with `vp node packages/reference/scripts/collect-defined-names.ts`.

import { DEFINED_NAMES, type MathJSON } from "@enumeratio/oracle/src";
import { expect, test } from "vite-plus/test";
import { declaredEngine } from "../scripts/engines.ts";
import { referenceData, referenceEntries } from "../src/node.ts";

function symbolsIn(expr: MathJSON, into: Set<string>): void {
  if (typeof expr === "string") {
    if (!/^'.*'$/s.test(expr)) into.add(expr);
    return;
  }
  if (Array.isArray(expr)) for (const item of expr) symbolsIn(item as MathJSON, into);
}

test("defined-names-data.ts is current", () => {
  const data = referenceData();
  const names = new Set<string>();
  for (const entry of referenceEntries(data)) {
    for (const example of entry.examples) {
      symbolsIn(example.expr as MathJSON, names);
      symbolsIn(example.expected as MathJSON, names);
    }
  }
  const ce = declaredEngine();
  const defined = [...names].filter((name) => ce.lookupDefinition(name) !== undefined).sort();
  expect(defined, "regenerate: vp node packages/reference/scripts/collect-defined-names.ts").toEqual(
    [...DEFINED_NAMES].sort(),
  );
}, 60_000); // walks every reference example and boxes every symbol through the full engine
