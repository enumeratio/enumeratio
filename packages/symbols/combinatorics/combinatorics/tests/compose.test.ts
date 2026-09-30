import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareCompose, publicName } from "@enumeratio/structures";
import { expect, test } from "vite-plus/test";
import { CARRIERS, declareCombinatoricsCarriers } from "../src/carriers.ts";
import { declareMaps, MAPS } from "../src/maps.ts";

const ce = new ComputeEngine();
declareCombinatoricsCarriers(ce);
declareMaps(ce, Object.fromEntries(CARRIERS.map((c) => [c.type, c.name])));
declareCompose(ce);

const perm = (...entries: number[]): unknown => ["Permutation", ["List", ...entries]];
const value = (expr: unknown): unknown => ce.box(expr as never).evaluate().json;

test("composition is an operation, so the names are optional", () => {
  // `ReverseComplement` and `InverseAfterComplementAfterReverse` are catalog names for
  // things that are not new. With `Compose` they need no name at all — which is the same
  // argument as anonymous restrictions, and the reason FindStat has a head called
  // `InverseAfterComplementAfterReverse` in the first place.
  for (const p of [[1], [2, 1], [2, 3, 1], [3, 1, 4, 2]]) {
    expect(value([["Compose", "Complement", "Reverse"], perm(...p)]), `[${p.join(", ")}]`).toEqual(
      value(["ReverseComplement", perm(...p)]),
    );
    expect(value([["Compose", "Inverse", "Complement", "Reverse"], perm(...p)]), `[${p.join(", ")}]`).toEqual(
      value(["InverseAfterComplementAfterReverse", perm(...p)]),
    );
  }
});

test("Composition reads right to left, as it is written", () => {
  // Compose(f, g)(x) is f(g(x)) — the ordinary mathematical reading, not a pipeline.
  const p = perm(2, 3, 1);
  expect(value([["Compose", "Complement", "Reverse"], p])).toEqual(value(["Complement", ["Reverse", p]]));
});

test("a composition of one step is that step", () => {
  const p = perm(2, 3, 1);
  expect(value([["Compose", "Inverse"], p])).toEqual(value(["Inverse", p]));
});

test("a private name is one character from its public spelling", () => {
  // The marker is a TRAILING underscore: legal in a symbol, never at the end of a real head,
  // and one character to strip when emitting an AST for a reader -- `publicName` is a no-op
  // on a name that was never private in the first place.
  expect(publicName("Complement_")).toBe("Complement");
  expect(publicName("Complement")).toBe("Complement");
});

test("extending a collection-backed head never leaks a private name into a result", () => {
  // `Complement` is collection-backed; a `Set` operand is not the carrier our combinatorics
  // extension handles, so the call stays genuinely unevaluated -- under its own name, not a
  // private duplicate (see @enumeratio/structures' extend.ts).
  const result = ce.box(["Complement", ["Set", 1, 2]]).evaluate();
  expect(result.operator).toBe("Complement");
  expect(JSON.stringify(result.json)).not.toContain("Complement_");
});

test("every composed map lists steps that exist", () => {
  for (const map of MAPS)
    for (const step of map.composedOf ?? [])
      expect(
        MAPS.some((m) => m.name === step),
        `${map.name} -> ${step}`,
      ).toBe(true);
});
