import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, expect, it } from "vite-plus/test";
import { runCommand } from "../src/command.ts";
import { Session } from "../src/engine.ts";
import { keysOf } from "../src/drive.ts";
import { pager } from "../src/pager.ts";
import { openTable, staticText } from "../src/table.ts";

// Not a head's value, so a golden of the drawing. Regenerate with `UPDATE_TABLES=1 vp test`.
const GOLDEN = fileURLToPath(new URL("./table.golden.json", import.meta.url));
const updating = process.env.UPDATE_TABLES === "1";
const golden: Record<string, string> = updating ? {} : JSON.parse(readFileSync(GOLDEN, "utf8"));
const fresh: Record<string, string> = {};

const session = new Session();
const opened = (input: string) => {
  const result = openTable(session.ce, session.evaluate(input).expr.json as never);
  if ("error" in result) throw new Error(result.error);
  return result.table;
};

const CASES: Record<string, string> = {
  infinite: "CollectionTable(NonNegativeIntegers)",
  statistic: 'CollectionTable(SymmetricGroup(3), Columns -> "Descents")',
  huge: "CollectionTable(SymmetricGroup(25), MaxItems -> 3)",
  finite: "CollectionTable(Subsets(3))",
  pinned: "CollectionTable(NonNegativeIntegers, ScrollPosition -> 100, MaxItems -> 3)",
};

for (const [name, input] of Object.entries(CASES)) {
  it(`draws ${name} as a ruled grid and its Skeleton line`, async () => {
    const text = await staticText(opened(input));
    fresh[name] = text;
    if (!updating) expect(text).toBe(golden[name]);
  });
}

it("ends a page that ran out of rows without a Skeleton line", async () => {
  const text = await staticText(opened("CollectionTable(Subsets(3))"));
  expect(text.split("\n").at(-1)).toContain("│");
});

it("reaches the last row of SymmetricGroup(25) with G, on the real source", async () => {
  let wrote = "";
  const table = opened("CollectionTable(SymmetricGroup(25))");
  const d = pager(table.source, { write: (t) => (wrote += t), color: false, columns: () => 200, height: () => 11 });
  d.draw();
  await d.idle();
  for (const k of keysOf("G")) d.key(k);
  await d.idle();
  expect(d.text()).toContain("15511210043330985984000000 │ Permutation([25, 24, 23");
  expect(d.text()).toContain("of ≈ 1.55 × 10²⁵");
  expect(wrote).toContain("q quit");
});

it("hands a table to a host that draws tables, and prints plain text elsewhere", () => {
  expect(runCommand(["show", CASES.infinite!], undefined, {}, { tables: true }).table).toBeDefined();
  expect(runCommand(["show", CASES.infinite!]).stdout).toContain("ScrollPosition");
  expect(runCommand(["show", "--json", CASES.infinite!], undefined, {}, { tables: true }).table).toBeUndefined();
});

afterAll(() => {
  if (updating) writeFileSync(GOLDEN, `${JSON.stringify(fresh, null, 2)}\n`);
});
