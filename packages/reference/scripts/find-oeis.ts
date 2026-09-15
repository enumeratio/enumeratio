// Ask the OEIS which sequences each of our collection families COUNTS, by value, and
// rewrite `src/oeis-data.ts`.
//
// A family with one size parameter has a counting sequence -- `count([0])`, `count([1])`,
// … -- and the OEIS search takes a sequence. So: compute the first terms from the pack's
// own count kernel, search, and keep every sequence whose data agrees term for term once
// aligned (the OEIS may start a term or two earlier or later). That verifies the A-numbers
// the catalog recorded and finds the ones it did not, the same way the FindStat lane does
// for statistics.
//
// A family with TWO parameters is a triangle, and the OEIS keeps triangles flattened "read
// by rows". Same method, one extra degree of freedom: where the triangle starts. Pascal's
// runs from n = 0 and k = 0, Stirling's from n = 1 and k = 1, so the rows and columns to
// drop are searched over and the window that matches is recorded -- which is itself the
// useful fact, since it says how the other convention is indexed.
//
// The OEIS sits behind a bot check that refuses Node's fetch but not curl, so the request
// goes through curl. One request per family, a second apart.
//
//   vp node packages/reference/scripts/find-oeis.ts [--only DyckPaths]

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { allEntries } from "@enumeratio/collections/src";
import type { OeisMatch } from "../src/oeis-data.ts";

const only = process.argv.includes("--only")
  ? process.argv[process.argv.indexOf("--only") + 1]
  : undefined;

/** Terms we can trust: exact in a double, and not so many the search string is silly. */
const MAX_TERMS = 16;
const SAFE = Number.MAX_SAFE_INTEGER;

/** How many aligned terms it takes to call it a match -- fewer and small sequences collide. */
const MIN_AGREED = 8;
/** Rows of a triangle to flatten; 6 rows is 21 terms, plenty to pin one down. */
const MAX_ROWS = 7;

interface Found {
  readonly id: string;
  readonly name: string;
  readonly offset: number;
  readonly terms: readonly number[];
}

/** The OEIS's internal text format: one `%X A000000 …` line per field. */
function parse(text: string): Found[] {
  const out: Found[] = [];
  let current: { id: string; name: string; offset: number; data: string } | undefined;
  for (const line of text.split("\n")) {
    const match = /^%([A-Z]) (A\d{6}) ?(.*)$/.exec(line);
    if (!match) continue;
    const [, field, id, rest] = match;
    if (field === "I") {
      if (current) out.push(finish(current));
      current = { id: id!, name: "", offset: 0, data: "" };
      continue;
    }
    if (!current || current.id !== id) continue;
    if (field === "S" || field === "T" || field === "U") current.data += rest;
    if (field === "N") current.name = rest!;
    if (field === "O") current.offset = Number(rest!.split(",")[0]);
  }
  if (current) out.push(finish(current));
  return out;
}
const finish = (c: { id: string; name: string; offset: number; data: string }): Found => ({
  id: c.id,
  name: c.name,
  offset: c.offset,
  terms: c.data
    .split(",")
    .filter(Boolean)
    .map((t) => (Number(t) <= SAFE ? Number(t) : Number.NaN)),
});

function search(terms: readonly number[]): Found[] {
  const url = `https://oeis.org/search?q=${terms.join(",")}&fmt=text&n=40`;
  const text = execFileSync(
    "curl",
    ["-s", "-A", "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/120 Safari/537.36", url],
    { encoding: "utf8" },
  );
  return parse(text);
}

/**
 * The shift that lines our terms up with the sequence's, if one does: ours[n] is
 * theirs[n + shift] for every n both have, over at least MIN_AGREED terms.
 */
function aligned(ours: readonly number[], theirs: readonly number[], from = 0): number | undefined {
  for (const shift of [0, 1, -1, 2, -2]) {
    let agreed = 0;
    let ok = true;
    for (let n = from; n < ours.length; n++) {
      const j = n + shift;
      if (j < 0 || j >= theirs.length) continue;
      if (Number.isNaN(theirs[j])) continue;
      if (ours[n] !== theirs[j]) {
        ok = false;
        break;
      }
      agreed++;
    }
    if (ok && agreed >= MIN_AGREED) return shift;
  }
  return undefined;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Our flattened terms appear in theirs, contiguously and in order, from some index. */
function contained(ours: readonly number[], theirs: readonly number[]): number | undefined {
  for (let start = 0; start + ours.length <= theirs.length; start++) {
    let ok = true;
    for (let i = 0; i < ours.length; i++) {
      const mine = ours[i]!;
      const other = theirs[start + i]!;
      if (Number.isNaN(other)) continue;
      if (mine !== other) {
        ok = false;
        break;
      }
    }
    if (ok) return start;
  }
  return undefined;
}

const matches: OeisMatch[] = [];

// ── triangles: the two-parameter families, flattened row by row ──────────────────────────
for (const entry of allEntries) {
  if (only && entry.head !== only) continue;
  if (entry.paramCount !== 2) continue;
  const rows: number[][] = [];
  for (let n = 0; n < MAX_ROWS; n++) {
    const row: number[] = [];
    for (let k = 0; k <= n; k++) {
      const value = entry.count([n, k]);
      if (!Number.isFinite(value) || value > SAFE) break;
      row.push(value);
    }
    if (row.length !== n + 1) break;
    rows.push(row);
  }
  // Where the triangle starts is a convention: try dropping leading rows and the k = 0
  // column, take the first window the OEIS knows, and record it.
  let best: { seq: Found; from: number; skipRows: number; skipColumns: number } | undefined;
  for (const skipRows of [0, 1, 2]) {
    for (const skipColumns of [0, 1]) {
      if (best) break;
      const window = rows.slice(skipRows).map((row) => row.slice(skipColumns));
      const flat = window.flat();
      if (flat.length < MIN_AGREED) continue;
      const seqs = search(flat);
      const hit = seqs.find((seq) => contained(flat, seq.terms) !== undefined);
      if (hit) best = { seq: hit, from: flat.length, skipRows, skipColumns };
      await sleep(1200);
    }
  }
  process.stdout.write(
    `${entry.head}: ${best ? `${best.seq.id} (${best.from} terms, rows from ${best.skipRows}, columns from ${best.skipColumns})` : "—"}\n`,
  );
  if (best) {
    matches.push({
      head: entry.head,
      oeis: best.seq.id,
      name: best.seq.name,
      shift: 0,
      terms: best.from,
      triangle: { skipRows: best.skipRows, skipColumns: best.skipColumns },
    });
  }
}

// ── sequences: the one-parameter families ────────────────────────────────────────────────
for (const entry of allEntries) {
  if (only && entry.head !== only) continue;
  if (entry.paramCount !== 1) continue;
  const ours: number[] = [];
  for (let n = 0; n < MAX_TERMS; n++) {
    const value = entry.count([n]);
    if (!Number.isFinite(value) || value > SAFE) break;
    ours.push(value);
  }
  if (ours.length < MIN_AGREED) {
    process.stdout.write(`${entry.head}: only ${ours.length} exact terms, skipped\n`);
    continue;
  }
  // The search string: skip leading terms that are all 0s and 1s, which match everything.
  const informative = ours.findIndex((t) => t > 1);
  const query = ours.slice(Math.max(0, informative - 1));
  // The empty object is where conventions differ (n^(n-2) trees on 0 nodes: 0 here, 1 in
  // the OEIS); a sequence that agrees from n = 1 is still the sequence, and the difference
  // is worth recording rather than hiding.
  const found = search(query)
    .map((seq) => {
      const shift = aligned(ours, seq.terms);
      if (shift !== undefined) return { seq, shift, from: 0 };
      const fromOne = aligned(ours, seq.terms, 1);
      return fromOne === undefined ? undefined : { seq, shift: fromOne, from: 1 };
    })
    .filter((x): x is { seq: Found; shift: number; from: number } => x !== undefined)
    .slice(0, 6);
  process.stdout.write(
    `${entry.head}: ${found.map((f) => `${f.seq.id}${f.from ? "*" : ""}`).join(" ") || "—"} (${ours.length} terms)\n`,
  );
  for (const { seq, shift, from } of found) {
    matches.push({
      head: entry.head,
      oeis: seq.id,
      name: seq.name,
      shift,
      terms: ours.length - from,
      ...(from ? { atZero: { ours: ours[0]!, theirs: seq.terms[shift] ?? Number.NaN } } : {}),
    });
  }
  await sleep(1200);
}

if (!only) {
  writeFileSync(
    new URL("../src/oeis-data.ts", import.meta.url),
    `// GENERATED by scripts/find-oeis.ts — do not edit by hand.
//
// Which OEIS sequences each collection family counts, decided by VALUE: the family's own
// count kernel for the first sizes, searched, and kept where the terms agree once aligned.
// Regenerate with:
//
//   vp node packages/reference/scripts/find-oeis.ts

/** One family and one sequence whose terms its counts agree with. */
export interface OeisMatch {
  readonly head: string;
  readonly oeis: string;
  /** The sequence's name, as the OEIS gives it. */
  readonly name: string;
  /** Our count at size n is the sequence's term at index n + shift. */
  readonly shift: number;
  /** How many of our terms were compared. */
  readonly terms: number;
  /** Set when the two disagree only on the empty object -- a convention, recorded, not hidden. */
  readonly atZero?: { readonly ours: number; readonly theirs: number };
  /**
   * Set for a two-parameter family: the sequence is its triangle read by rows, starting at
   * this row and column. \`{0, 0}\` is our own indexing; anything else is the OEIS's.
   */
  readonly triangle?: { readonly skipRows: number; readonly skipColumns: number };
}

export const oeis: readonly OeisMatch[] = ${JSON.stringify(matches, null, 2)};
`,
  );
  process.stdout.write(`${matches.length} sequences matched\n`);
}
