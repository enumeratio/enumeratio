// The incremental modes of `find-findstat*.ts` must write what a full run writes: same rows, same
// order. Here a full run is `assemble` with everything selected, over a small fixture whose
// `match` stands in for the slow value-matching.
import { expect, test } from "vite-plus/test";
import { assemble, parseHeads, parseRename, renamed, selected } from "../scripts/findstat-incremental.ts";

interface Item {
  readonly name: string;
  readonly from: string;
}
interface Row {
  readonly name: string;
  readonly from: string;
  readonly ids: readonly string[];
}

const item = (name: string, from: string): Item => ({ name, from });
const keyOf = (i: Item): string => `${i.name}@${i.from}`;
/** What each name computes: a rename keeps the behavior, so the matching does not depend on the name itself. */
const BEHAVIOR: Readonly<Record<string, string>> = { Reverse: "a", Backwards: "a", Sort: "b", SkipMe: "c" };
/** A stand-in for the matching. */
const match = (i: Item): Row | undefined =>
  i.name.startsWith("Skip") ? undefined : { name: i.name, from: i.from, ids: [`Mp-${BEHAVIOR[i.name]}-${i.from}`] };
const asKey = (r: Row) => ({ head: r.name, carrier: r.from });
const rename = (r: Row, to: string): Row => ({ ...r, name: to });

const universe = [
  item("Reverse", "Permutation"),
  item("Reverse", "Composition"),
  item("SkipMe", "Permutation"),
  item("Sort", "Permutation"),
];
const everything = (): boolean => true;
const full = assemble(universe, keyOf, new Map(), everything, match);

test("a full run keeps unmatched maps out", () => {
  expect(full.map((r) => keyOf(r))).toEqual(["Reverse@Permutation", "Reverse@Composition", "Sort@Permutation"]);
});

test("rematching some heads over the committed rows equals a full run", () => {
  const previous = renamed(full, asKey, rename, []);
  for (const heads of [["Reverse"], ["Sort", "SkipMe"], ["Reverse@Composition"], []]) {
    const wanted = parseHeads(heads);
    const calls: string[] = [];
    const rows = assemble(
      universe,
      keyOf,
      previous,
      (i) => selected(wanted, i.name, i.from),
      (i) => {
        calls.push(keyOf(i));
        return match(i);
      },
    );
    expect(rows).toEqual(full);
    expect(calls.length).toBeLessThan(universe.length);
  }
});

test("a bare head selects every carrier, head@carrier just one", () => {
  expect(selected(parseHeads(["Reverse"]), "Reverse", "Composition")).toBe(true);
  expect(selected(parseHeads(["Reverse@Permutation"]), "Reverse", "Composition")).toBe(false);
  expect(parseHeads(["A,B", "C"])).toEqual(new Set(["A", "B", "C"]));
});

test("renaming a committed row in place equals a full run over the renamed universe", () => {
  const after = universe.map((i) => (keyOf(i) === "Reverse@Permutation" ? item("Backwards", i.from) : i));
  const expected = assemble(after, keyOf, new Map(), everything, match);
  const previous = renamed(full, asKey, rename, [parseRename("Reverse=Backwards@Permutation")]);
  const calls: string[] = [];
  const rows = assemble(
    after,
    keyOf,
    previous,
    () => false,
    (i) => (calls.push(keyOf(i)), match(i)),
  );
  expect(rows).toEqual(expected);
  expect(calls).toEqual([]);
});

test("a malformed rename is refused", () => {
  expect(() => parseRename("Reverse=Backwards")).toThrow(/Old=New@Carrier/);
});
