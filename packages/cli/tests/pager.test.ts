import { expect, it } from "vite-plus/test";
import type { IndexRange, RowBatch, RowCount, RowSource } from "@enumeratio/boxes";
import { keysOf } from "../src/drive.ts";
import { clip, pager } from "../src/pager.ts";

/** A source of `n` rows (or no end, or an unsettled count) whose row `i` says `r<i>`; no engine, no terminal. */
function fake(count: RowCount, rows = count.kind === "exact" ? count.n : 1_000_000n): RowSource {
  return {
    random: true,
    columns: [{ label: "element" }],
    count: () => count,
    rows: async ([from, to]: IndexRange): Promise<RowBatch> => {
      const end = to < rows + 1n ? to : rows + 1n;
      const out = [];
      for (let i = from; i < end; i++) out.push([`r${i}`]);
      return { start: from, rows: out, count, ...(end < to && { end: true }) };
    },
  };
}

/** A pager on a 11-row, 80-column screen (four rows a page), and the keys to press on it. */
function screen(source: RowSource, columns = 80) {
  let wrote = "";
  const d = pager(source, { write: (text) => (wrote += text), color: false, columns: () => columns, height: () => 11 });
  return {
    d,
    /** What was drawn since the last press, once its rows are in. */
    async press(...chunks: string[]): Promise<string> {
      wrote = "";
      let done = false;
      for (const chunk of chunks) for (const k of keysOf(chunk)) done = d.key(k) || done;
      await d.idle();
      return done ? "[done]" : wrote;
    },
    async start(): Promise<string> {
      d.draw();
      await d.idle();
      return d.text();
    },
  };
}

const status = (text: string): string => text.split("\n").find((l) => l.startsWith("rows") || l.startsWith("no rows"))!;

it("draws the visible rows only, sized to the terminal, with its place in the count", async () => {
  const s = screen(fake({ kind: "exact", n: 100n }));
  const page = await s.start();
  expect(status(page)).toBe("rows 1–4 of 100");
  expect(page).toContain("r4");
  expect(page).not.toContain("r5");
});

it("moves a row with j/k and arrows, a page with space/b, to the ends with g/G", async () => {
  const s = screen(fake({ kind: "exact", n: 100n }));
  await s.start();
  expect(status(await s.press("j"))).toBe("rows 2–5 of 100");
  expect(status(await s.press("\x1b[B"))).toBe("rows 3–6 of 100");
  expect(status(await s.press("k"))).toBe("rows 2–5 of 100");
  expect(status(await s.press(" "))).toBe("rows 6–9 of 100");
  expect(status(await s.press("b"))).toBe("rows 2–5 of 100");
  expect(status(await s.press("G"))).toBe("rows 97–100 of 100");
  expect(await s.press("j")).toContain("the last row");
  expect(status(await s.press("g"))).toBe("rows 1–4 of 100");
  expect(await s.press("k")).toContain("the first row");
});

it("jumps to a typed row, and says when the row is past the end", async () => {
  const s = screen(fake({ kind: "exact", n: 100n }));
  await s.start();
  expect(await s.press(":")).toContain("jump to row: ");
  expect(await s.press("5", "0")).toContain("jump to row: 50");
  expect(status(await s.press("\r"))).toBe("rows 50–53 of 100");
  await s.press(":", "9", "\x7f", "9", "9", "9");
  const past = await s.press("\r");
  expect(past).toContain("rows 97–100 of 100");
  expect(past).toContain("only 100 rows");
  await s.press(":");
  expect(await s.press("\x1b")).toContain("q quit");
});

it("quits on q, escape or ctrl-c", async () => {
  const s = screen(fake({ kind: "exact", n: 10n }));
  await s.start();
  expect(await s.press("q")).toBe("[done]");
  expect(await s.press("\x1b")).toBe("[done]");
  expect(await s.press("\x03")).toBe("[done]");
});

it("declines G for a source with no end or no count yet, and counts it as such", async () => {
  const infinite = screen(fake({ kind: "infinite" }));
  expect(status(await infinite.start())).toBe("rows 1–4 of ∞");
  expect(await infinite.press("G")).toContain("G: the rows have no end");
  expect(status(infinite.d.text())).toBe("rows 1–4 of ∞");
  expect(status(await infinite.press(" "))).toBe("rows 5–8 of ∞");

  const walking = screen(fake({ kind: "atLeast", n: 50n, growing: true }, 50n));
  expect(status(await walking.start())).toBe("rows 1–4 of ≥ 50");
  expect(await walking.press("G")).toContain("G: the row count is not known yet");
});

it("holds a bigint row index, and writes a long one in scientific form when the line is narrow", async () => {
  const n = 15511210043330985984000000n;
  const wide = screen(fake({ kind: "exact", n }, n), 200);
  await wide.start();
  await wide.press("G");
  expect(status(wide.d.text())).toBe(
    "rows 15,511,210,043,330,985,983,999,997–15,511,210,043,330,985,984,000,000 of ≈ 1.55 × 10²⁵",
  );
  const narrow = screen(fake({ kind: "exact", n }, n), 60);
  await narrow.start();
  await narrow.press("G");
  const line = status(narrow.d.text());
  expect(Array.from(line).length).toBeLessThanOrEqual(60);
  expect(line).toBe("rows 1.55 × 10²⁵–1.55 × 10²⁵ of ≈ 1.55 × 10²⁵");
  await narrow.press(":", ..."15511210043330985984000000".split(""), "\r");
  expect(status(narrow.d.text())).toBe("rows 1.55 × 10²⁵–1.55 × 10²⁵ of ≈ 1.55 × 10²⁵");
});

it("stays on the page it has when a row past an unmeasured end is asked for", async () => {
  const s = screen(fake({ kind: "atLeast", n: 0n, growing: true }, 6n));
  await s.start();
  await s.press(" ");
  expect(status(s.d.text())).toBe("rows 5–6 of ≥ 0");
  expect(await s.press(" ")).toContain("the last row");
  expect(status(s.d.text())).toBe("rows 5–6 of ≥ 0");
});

it("clips a line to the width, eliding text but not a rule", () => {
  expect(clip("abcdef", 4)).toBe("abc…");
  expect(clip("ab", 4)).toBe("ab");
  expect(clip("──┼────", 4)).toBe("──┼");
});
