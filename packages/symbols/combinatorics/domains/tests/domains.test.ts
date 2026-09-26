import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { contentsOf, declareDomains } from "../src/declare.ts";
import { DOMAINS } from "../src/domain-data.ts";

const engine = (): ComputeEngine => {
  const ce = new ComputeEngine();
  declareDomains(ce);
  return ce;
};

test("every carrier the catalog knows becomes a nominal type", () => {
  const ce = engine();
  expect(DOMAINS.length).toBe(86);
  for (const domain of DOMAINS) expect(String(ce.type(domain.type)), domain.name).toBe(domain.type);
});

test("a nominal type does not match its own shape", () => {
  // This is the whole point of minting: `Permutations` is not interchangeable with the list
  // it happens to be stored as, in either direction.
  const ce = engine();
  expect(ce.type("permutation").matches("list<integer>")).toBe(false);
  expect(ce.type("list<integer>").matches("permutation")).toBe(false);
});

test("a constructed value keeps its domain through evaluation", () => {
  const ce = engine();
  const p = ce.box(["Permutations", ["List", 2, 1, 3]]);
  expect(p.evaluate().json).toEqual(["Permutations", ["List", 2, 1, 3]]);
  expect(String(p.evaluate().type)).toBe("permutation");
});

test("a head over one domain rejects a value of another", () => {
  // The reason to do any of this: passing a set partition to a permutation statistic is a
  // type error, not a quiet wrong answer.
  const ce = engine();
  ce.declare("FirstEntry", {
    signature: "(permutation) -> integer",
    evaluate: (ops) => ce.box(["At", contentsOf(ops[0]) as never, 1]).evaluate(),
  });

  expect(ce.box(["FirstEntry", ["Permutations", ["List", 2, 1, 3]]]).evaluate().re).toBe(2);

  const rawList = ce.box(["FirstEntry", ["List", 2, 1, 3]]).evaluate();
  expect(rawList.operator).toBe("Error");

  const wrongDomain = ce.box(["FirstEntry", ["SetPartitions", ["List", 0, 0, 1]]]).evaluate();
  expect(wrongDomain.operator).toBe("Error");
});

test("constructed values survive inside a list", () => {
  // A collection of carrier values has to stay a collection of carrier values.
  const ce = engine();
  const p = ["Permutations", ["List", 2, 1]] as const;
  expect(ce.box(["List", p, p] as never).evaluate().json).toEqual(["List", p, p]);
});

test("the shapes are enumeratio's actual storage, not an idealisation", () => {
  const shape = (name: string): string | undefined => DOMAINS.find((d) => d.name === name)?.shape;
  // A set partition is a restricted growth string, NOT a list of blocks — reasoning from the
  // name would have got this wrong, which is why the shapes are extracted rather than guessed.
  expect(shape("SetPartitions")).toBe("list<integer>");
  expect(shape("RationalNumbers")).toBe("tuple<integer, integer>");
  expect(shape("ModularResidues")).toBe("tuple<integer, integer>");
  // A composite carrier names other carriers by their TYPE, which is the id verbatim.
  expect(shape("StandardTableauPairs")).toBe("tuple<standard_tableau, standard_tableau>");
});

test("the type is the carrier id verbatim, and never the constructor's spelling", () => {
  // compute-engine spells its own types lowercase and snake_case (`integer`,
  // `indexed_collection`), so a carrier's type needs no transformation — enumeratio's id
  // already is one. That is what frees the TitleCase singular for the constructor.
  for (const domain of DOMAINS) expect(domain.type).toBe(domain.id);
});

test("a type and its constructor never share a spelling", () => {
  // compute-engine keeps types and symbols in ONE namespace, so this is not a style rule —
  // sharing a name throws "already declared in this scope".
  for (const domain of DOMAINS) expect(domain.type).not.toBe(domain.name);
});
