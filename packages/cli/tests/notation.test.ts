import { NOTATIONS } from "@enumeratio/manifest";
import { expect, test } from "vite-plus/test";
import { Session } from "../src/engine.ts";
import { NOTATION_ENTRIES } from "../src/notation.ts";

test("the session loads every package's notation entry the manifest lists", () => {
  expect(Object.keys(NOTATION_ENTRIES).toSorted()).toEqual(Object.keys(NOTATIONS).toSorted());
});

test("packages' LaTeX parses and writes in a session: residues' \\pmod, combinatorics' carriers", () => {
  const session = new Session();
  expect(session.parse(":latex 2 \\pmod{5}").raw.json).toEqual(["ResidueClass", 2, 5]);
  expect(session.parse(":latex x = 2 \\pmod{5}").raw.json).toEqual(["Congruent", "x", 2, 5]);
  expect(session.parse(":latex \\permutation(2, 3, 1)").raw.json).toEqual(["Permutation", ["List", 2, 3, 1]]);
  expect(session.render(session.evaluate("Permutation([2, 3, 1])").expr, "tex")).toBe("\\permutation([2, 3, 1])");
});
