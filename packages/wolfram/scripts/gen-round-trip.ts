// Regenerate the round-trip golden from the reference corpus: one example per distinct
// head-signature set, its Wolfram source, and — where the trip is lossy by construction
// (see `applyHead` in from-wolfram.ts) — what actually comes back. The golden is what
// the test asserts against; this only rewrites it, so a change in the transpiler shows
// up as a diff to review rather than a silently moved target.
//
//   vp node packages/wolfram/scripts/gen-round-trip.ts

import { writeFileSync } from "node:fs";
import { referenceEntries } from "../../reference/src/node.ts";
import { fromWolfram } from "../src/from-wolfram.ts";
import { type MathJson, toWolfram } from "../src/to-wolfram.ts";

const entries = referenceEntries();

interface Golden {
  readonly id: string;
  readonly expr: MathJson;
  readonly wolfram: string;
  /** Present only when `fromWolfram(wolfram)` is not `expr` — a documented lossy trip. */
  readonly back?: MathJson;
}

const signatures = (node: MathJson, into: Set<string>): Set<string> => {
  if (Array.isArray(node)) {
    if (typeof node[0] === "string") into.add(`${node[0]}/${node.length - 1}`);
    for (const arg of node.slice(1)) signatures(arg, into);
  } else if (typeof node === "string" && /^'.*'$/s.test(node)) into.add("'string'");
  else if (typeof node === "string" && /^_\d+$/.test(node)) into.add("_slot");
  return into;
};

/** MathJSON allows a number spelled as a string (`"2"`); `toWolfram` emits it as the
 * number, so pin the canonical numeric form rather than record a spurious lossy trip. */
const canonical = (node: MathJson): MathJson => {
  if (typeof node === "string" && /^[-+]?\d+(\.\d+)?$/.test(node)) return Number(node);
  if (Array.isArray(node)) return node.map(canonical);
  return node;
};

const seen = new Set<string>();
const golden: Golden[] = [];
for (const entry of entries) {
  for (const [i, example] of entry.examples.entries()) {
    if (example.aspirational) continue;
    const expr = canonical(example.expr as MathJson);
    const key = [...signatures(expr, new Set())].sort().join(" ");
    if (seen.has(key)) continue;
    seen.add(key);
    const wolfram = toWolfram(expr);
    const back = fromWolfram(wolfram);
    const same = JSON.stringify(back) === JSON.stringify(expr);
    golden.push({ id: `${entry.name}#${i + 1}`, expr, wolfram, ...(same ? {} : { back }) });
  }
}

writeFileSync(new URL("../tests/golden/round-trip.json", import.meta.url), `${JSON.stringify(golden, null, 2)}\n`);
const lossy = golden.filter((g) => g.back !== undefined).length;
console.log(`round-trip golden: ${golden.length} cases (${lossy} lossy)`);
