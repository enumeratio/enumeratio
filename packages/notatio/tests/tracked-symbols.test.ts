import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { parseNotatio } from "@enumeratio/formats/notatio";
import { expect, test } from "vite-plus/test";
import {
  affected,
  cellBindings,
  isTracked,
  schedule,
  type CellBindings,
  type TrackedSymbols,
} from "../src/tracked-symbols.ts";

const ce = new ComputeEngine();

/** `sources[i]` becomes cell `i + 1` -- document order is the id order throughout. */
function bindingsOf(...sources: string[]): CellBindings[] {
  return sources.map((src, i) => {
    const { json, errors } = parseNotatio(src, { allow: ["Assign"] });
    if (errors.length) throw new Error(errors.join("; "));
    return cellBindings(ce, i + 1, src, json);
  });
}

// --- cellBindings ---------------------------------------------------------------------

test("an assignment's own name is not counted among what it reads", () => {
  const [b] = bindingsOf("a := a + 1");
  expect(b.assigns).toBe("a");
  expect(b.reads).not.toContain("a");
});

test("a bare expression assigns nothing and reads its free symbols", () => {
  const [b] = bindingsOf("a + b");
  expect(b.assigns).toBeUndefined();
  expect(b.reads).toEqual(["a", "b"]);
});

test("a cell-number reference is flagged, whatever else it does", () => {
  // `Out[1]` (Wolfram bracket indexing) is compute-engine's `At(Out, 1)` -- the shape
  // `referencesOrdinal` itself is tested against in `reactive.test.ts`.
  const b = cellBindings(ce, 1, "x + 1", ["Add", "x", ["At", "Out", 1]] as never);
  expect(b.ordinal).toBe(true);
});

test("the shorthand @_n is flagged from the source text alone", () => {
  const b = cellBindings(ce, 1, "@_1 + 1", undefined);
  expect(b.ordinal).toBe(true);
});

// --- isTracked --------------------------------------------------------------------

test("All, Automatic and true track every name; a list tracks only its own", () => {
  for (const t of ["All", "Automatic", true] as const) expect(isTracked(t, "anything")).toBe(true);
  expect(isTracked(["a", "b"], "a")).toBe(true);
  expect(isTracked(["a", "b"], "c")).toBe(false);
});

// --- schedule / affected: golden corpus --------------------------------------------

interface Case {
  name: string;
  sources: string[];
  tracked: TrackedSymbols;
  /** Which cell (1-based) commits, for `affected`. */
  changed: number;
}

const CASES: readonly Case[] = [
  {
    name: "diamond: b and a's order does not matter, both feed c",
    sources: ["b := a + 1", "a := 5", "b^2"],
    tracked: "All",
    changed: 2, // `a := 5` commits
  },
  {
    name: "an edit to an untracked symbol still re-runs itself, nothing downstream",
    sources: ["a := 1", "b := a + 1"],
    tracked: [],
    changed: 1,
  },
  {
    name: "a tracked list only propagates through the named symbols",
    sources: ["a := 1", "b := 2", "c := a + b"],
    tracked: ["a"],
    changed: 2, // b changes, but only a is tracked
  },
  {
    name: "two cells assigning the same name is an error on both, no order for either",
    sources: ["a := 1", "a := 2", "a + 1"],
    tracked: "All",
    changed: 1,
  },
  {
    name: "a cycle is an error on every member",
    sources: ["a := b + 1", "b := a + 1"],
    tracked: "All",
    changed: 1,
  },
  {
    name: "independent cells keep document order",
    sources: ["a := 1", "b := 2", "a + b"],
    tracked: "All",
    changed: 1,
  },
];

test("a cell holding an ordinal reference is rejected out of a reactive schedule", () => {
  const cells: CellBindings[] = [
    { id: 1, assigns: "a", reads: [], ordinal: false },
    { id: 2, reads: ["a", "Out"], ordinal: true },
  ];
  const sched = schedule(cells);
  expect(sched.order).toEqual([1]);
  expect(sched.diagnostics).toEqual([{ cellId: 2, message: expect.stringContaining("cell-number references") }]);
});

const GOLDEN = fileURLToPath(new URL("./tracked-symbols.golden.json", import.meta.url));
const updating = process.env.UPDATE_TRACKED_SYMBOLS === "1";
const golden: Record<string, unknown> = updating ? {} : JSON.parse(readFileSync(GOLDEN, "utf8"));
const fresh: Record<string, unknown> = {};

for (const { name, sources, tracked, changed } of CASES) {
  test(`schedule: ${name}`, () => {
    const cells = bindingsOf(...sources);
    const sched = schedule(cells);
    const result = {
      order: sched.order,
      diagnostics: sched.diagnostics,
      affected: affected(cells, sched, changed, tracked),
    };
    fresh[name] = result;
    if (!updating) expect(result).toEqual(golden[name]);
  });
}

test("golden file is up to date", () => {
  if (updating) writeFileSync(GOLDEN, JSON.stringify(fresh, null, 2) + "\n");
  else expect(Object.keys(fresh).sort()).toEqual(Object.keys(golden).sort());
});
