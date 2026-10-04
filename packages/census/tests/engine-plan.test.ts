// The census declares every library it depends on, and says why each is there: the engine is
// built from the hierarchy (`@enumeratio/manifest`'s `enginePlan`), so a library added as a
// dependency is declared, and one that leaves is not left behind in a list.

import { DECLARE_ORDER, PACKAGES } from "@enumeratio/manifest";
import { expect, test } from "vite-plus/test";
import { PACKAGE_DECLARATIONS, PLAN } from "../src/engine.ts";

const position = new Map(PLAN.order.map((library, at) => [library.name, at]));

test("every library is declared, after what it requires", () => {
  expect(PLAN.missing).toEqual([]);
  for (const library of PLAN.order) {
    for (const dep of [...(PACKAGES[library.name]?.requires ?? []), ...(library.requires ?? [])]) {
      const overridden = DECLARE_ORDER.some(([first, later]) => first === library.name && later === dep);
      if (position.has(dep) && !overridden)
        expect(position.get(dep), `${dep} before ${library.name}`).toBeLessThan(position.get(library.name)!);
    }
  }
});

test("evaluation and boxes come first and the catalog last", () => {
  expect(PLAN.order.slice(0, 2).map((library) => library.name)).toEqual(["evaluation", "boxes"]);
  expect(PLAN.order.at(-1)?.name).toBe("catalog");
});

test("each declaration is attributed to a package", () => {
  expect(PACKAGE_DECLARATIONS).toHaveLength(PLAN.steps.length);
  // The census's own steps count as combinatorics' contribution.
  expect(PACKAGE_DECLARATIONS.filter(([pkg]) => pkg === "combinatorics").length).toBeGreaterThan(1);
});
