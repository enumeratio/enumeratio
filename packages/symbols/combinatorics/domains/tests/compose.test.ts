import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareCompose } from "../src/compose.ts";
import { declareDomains } from "../src/declare.ts";
import { DOMAINS } from "../src/domain-data.ts";
import { declareMaps, MAPS } from "../src/map.ts";
import { publicName } from "../src/extend.ts";

const ce = new ComputeEngine();
declareDomains(ce);
declareMaps(ce, Object.fromEntries(DOMAINS.map((d) => [d.type, d.name])));
declareCompose(ce);

const perm = (...entries: number[]): unknown => ["Permutation", ["List", ...entries]];
const value = (expr: unknown): unknown => ce.box(expr as never).evaluate().json;

test("composition is an operation, so the names are optional", () => {
  // `ReverseComplement` and `InverseAfterComplementAfterReverse` are catalog names for
  // things that are not new. With `Compose` they need no name at all — which is the same
  // argument as anonymous restrictions, and the reason FindStat has a head called
  // `InverseAfterComplementAfterReverse` in the first place.
  for (const p of [[1], [2, 1], [2, 3, 1], [3, 1, 4, 2]]) {
    expect(value([["Compose", "Complement", "Reverse"], perm(...p)]), `[${p}]`).toEqual(
      value(["ReverseComplement", perm(...p)]),
    );
    expect(value([["Compose", "Inverse", "Complement", "Reverse"], perm(...p)]), `[${p}]`).toEqual(
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
  // and one character to strip when emitting an AST for a reader.
  expect(publicName("Complement_")).toBe("Complement");
  expect(publicName("Complement")).toBe("Complement");
  expect(JSON.stringify(ce.box(["Complement", ["Set", 1, 2]]).evaluate().json)).toContain("Complement_");
});

test("every composed map lists steps that exist", () => {
  for (const map of MAPS)
    for (const step of map.composedOf ?? [])
      expect(
        MAPS.some((m) => m.name === step),
        `${map.name} -> ${step}`,
      ).toBe(true);
});
