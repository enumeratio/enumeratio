import type { Engine } from "@enumeratio/engine";
import { bareEngine } from "@enumeratio/engine/testing";
import { contentsOf } from "@enumeratio/structures";
import { expect, test } from "vite-plus/test";
import { CARRIERS, declareCombinatoricsCarriers } from "../src/carriers.ts";

const engine = (): Engine => {
  const ce = bareEngine();
  declareCombinatoricsCarriers(ce);
  return ce;
};

test("every carrier the catalog knows becomes a nominal type", () => {
  const ce = engine();
  // combinatorics' own carriers — the areas' data, plus its findstat tooling records. The
  // arithmetic and GlyphKind carriers that used to live in LEFTOVER_CARRIERS moved to their
  // owning packages (https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 steps
  // 4-5); each package's own tests pin its own carrier count now.
  expect(CARRIERS.length).toBe(75);
  for (const carrier of CARRIERS) expect(String(ce.type(carrier.type)), carrier.name).toBe(carrier.type);
});

test("a nominal type does not match its own shape", () => {
  // This is the whole point of minting: `Permutation` is not interchangeable with the list
  // it happens to be stored as, in either direction.
  const ce = engine();
  expect(ce.type("permutation").matches("list<integer>")).toBe(false);
  expect(ce.type("list<integer>").matches("permutation")).toBe(false);
});

test("a constructed value keeps its carrier through evaluation", () => {
  const ce = engine();
  const p = ce.box(["Permutation", ["List", 2, 1, 3]]);
  expect(p.evaluate().json).toEqual(["Permutation", ["List", 2, 1, 3]]);
  expect(String(p.evaluate().type)).toBe("permutation");
});

test("a head over one carrier rejects a value of another", () => {
  // The reason to do any of this: passing a set partition to a permutation statistic is a
  // type error, not a quiet wrong answer.
  const ce = engine();
  ce.declare("FirstEntry", {
    signature: "(permutation) -> integer",
    evaluate: (ops) => ce.box(["At", contentsOf(ops[0]) as never, 1]).evaluate(),
  });

  expect(ce.box(["FirstEntry", ["Permutation", ["List", 2, 1, 3]]]).evaluate().re).toBe(2);

  const rawList = ce.box(["FirstEntry", ["List", 2, 1, 3]]).evaluate();
  expect(rawList.operator).toBe("Error");

  const wrongCarrier = ce.box(["FirstEntry", ["SetPartition", ["List", 0, 0, 1]]]).evaluate();
  expect(wrongCarrier.operator).toBe("Error");
});

test("constructed values survive inside a list", () => {
  // A collection of carrier values has to stay a collection of carrier values.
  const ce = engine();
  const p = ["Permutation", ["List", 2, 1]] as const;
  expect(ce.box(["List", p, p] as never).evaluate().json).toEqual(["List", p, p]);
});

test("the shapes are enumeratio's actual storage, not an idealisation", () => {
  const shape = (name: string): string | undefined => CARRIERS.find((c) => c.name === name)?.shape;
  // A set partition is its blocks, and its restricted growth string -- enumeratio's storage --
  // is a carrier of its own (scripts/shape-overrides.ts).
  expect(shape("SetPartition")).toBe("list<list<integer>>");
  expect(shape("RestrictedGrowthString")).toBe("list<integer>");
  // RationalNumber/ModularResidue moved to numerals/residues; their shapes are pinned there now.
  // A composite carrier names other carriers by their TYPE, which is the id verbatim.
  expect(shape("StandardTableauPair")).toBe("tuple<standard_tableau, standard_tableau>");
});

test("the type is the carrier id verbatim, and never the constructor's spelling", () => {
  // compute-engine spells its own types lowercase and snake_case (`integer`,
  // `indexed_collection`), so a carrier's type needs no transformation — enumeratio's id
  // already is one. That is what frees the TitleCase singular for the constructor.
  for (const carrier of CARRIERS) expect(carrier.type).toBe(carrier.id);
});

test("a type and its constructor never share a spelling", () => {
  // compute-engine keeps types and symbols in ONE namespace, so this is not a style rule —
  // sharing a name throws "already declared in this scope".
  for (const carrier of CARRIERS) expect(carrier.type).not.toBe(carrier.name);
});
