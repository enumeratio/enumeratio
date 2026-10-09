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

async function lastPage(input: string): Promise<{ text: string; wrote: string }> {
  let wrote = "";
  const table = opened(input);
  const d = pager(table.source, { write: (t) => (wrote += t), color: false, columns: () => 200, height: () => 11 });
  d.draw();
  await d.idle();
  for (const k of keysOf("G")) d.key(k);
  await d.idle();
  return { text: d.text(), wrote };
}

it("reaches the last row with G, on the real source", async () => {
  const { text, wrote } = await lastPage("CollectionTable(SymmetricGroup(8))");
  expect(text).toContain("40320 │ Permutation([8, 7, 6, 5, 4, 3, 2, 1])");
  expect(text).toContain("of 40,320");
  expect(wrote).toContain("q quit");
});

// Past 2^53 the index is a bigint end to end; seconds on a CI runner, so nightly only.
it.runIf(process.env.DEEP_TESTS === "1")(
  "reaches the last row of SymmetricGroup(25) with G",
  async () => {
    const { text } = await lastPage("CollectionTable(SymmetricGroup(25))");
    expect(text).toContain("15511210043330985984000000 │ Permutation([25, 24, 23");
    expect(text).toContain("of ≈ 1.55 × 10²⁵");
  },
  60_000,
);

it("hands a table to a host that draws tables, and prints plain text elsewhere", () => {
  expect(runCommand(["show", CASES.infinite!], undefined, {}, { tables: true }).table).toBeDefined();
  expect(runCommand(["show", CASES.infinite!]).stdout).toContain("ScrollPosition");
  expect(runCommand(["show", "--json", CASES.infinite!], undefined, {}, { tables: true }).table).toBeUndefined();
});

afterAll(() => {
  if (updating) writeFileSync(GOLDEN, `${JSON.stringify(fresh, null, 2)}\n`);
});
