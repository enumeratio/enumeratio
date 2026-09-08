// selfcert — the committed correctness harness for every collection this package ships. Runs the SAME bijection
// differential enumeratio's SQL core uses (see packages/data/selfcert.mts): for each family over a parameter grid,
// unrank every rank 0..count-1 and assert
//
//   • DISTINCT      — no two ranks yield the same element,
//   • VALID         — every element passes the family's own membership validator,
//   • COUNT         — the number of distinct elements equals the closed-form count(p),
//   • rank∘unrank=id — rank(unrank(p, r)) === r for every r.
//
// DISTINCT + VALID + COUNT together are a proof of a BIJECTION onto exactly the valid set of the right cardinality
// — not merely self-consistency of the rank/unrank pair (a mutually-wrong pair is caught by DISTINCT/COUNT unless
// it is ALSO a genuine bijection onto the right-sized valid set, which is the property we want). It does NOT prove
// ORDER agreement with the SQL floor for the seven SQL-twinned families — that is a separate differential that
// needs pg and lives outside this zero-dependency package (see the PR notes).
//
// Run the full sweep:  pnpm --filter @enumeratio/compute-engine selfcert
// A bounded slice runs in the vitest suite (selfcert.test.ts) so CI exercises it deterministically.
import { allEntries, type PackEntry } from "./src/packs/index.js";

export type SelfcertResult = { checks: number; fails: string[]; families: number; skipped: string[] };

/** Certify one family at one parameter point. `cap` bounds the enumeration so a huge count is skipped, not hung. */
function certify(entry: PackEntry, p: number[], cap: number, out: SelfcertResult): void {
  const n = entry.count(p);
  if (!Number.isFinite(n) || n < 0) { out.fails.push(`${entry.head}(${p}) count is ${n}`); return; }
  if (n > cap) { out.skipped.push(`${entry.head}(${p}) count ${n} > cap ${cap}`); return; }
  const seen = new Set<string>();
  for (let r = 0; r < n; r++) {
    const e = entry.unrank(p, r);
    const s = JSON.stringify(e);
    out.checks++;
    if (seen.has(s)) out.fails.push(`${entry.head}(${p}) duplicate at r=${r}: ${s}`);
    seen.add(s);
    if (!entry.valid(e, p)) out.fails.push(`${entry.head}(${p}) invalid element at r=${r}: ${s}`);
    const back = entry.rank(e, p);
    if (back !== r) out.fails.push(`${entry.head}(${p}) rank∘unrank≠id at r=${r}: got ${back}`);
  }
  if (seen.size !== n) out.fails.push(`${entry.head}(${p}) enumerated ${seen.size} distinct, count says ${n}`);
}

/** Sweep every family over a parameter grid. `nMax` caps the size axis; `cap` caps the enumeration per point. */
export function runSelfcert(nMax = 9, cap = 40000): SelfcertResult {
  const out: SelfcertResult = { checks: 0, fails: [], families: 0, skipped: [] };
  for (const entry of allEntries) {
    out.families++;
    if (entry.paramCount === 1) {
      for (let n = 0; n <= nMax; n++) certify(entry, [n], cap, out);
    } else {
      for (let n = 0; n <= nMax; n++) for (let k = 0; k <= n; k++) certify(entry, [n, k], cap, out);
    }
  }
  return out;
}

// Known-sequence anchors: the closed-form count must hit the OEIS value, so a wrong count is caught independently
// of the (self-referential) unrank. head → [param, expected count] rows.
const ANCHORS: Record<string, [number[], number][]> = {
  SymmetricGroup: [[[5], 120], [[6], 720]],
  DyckPaths: [[[4], 14], [[5], 42]], // Catalan
  SetPartitions: [[[4], 15], [[5], 52]], // Bell
  Involutions: [[[4], 10], [[5], 26]], // telephone
  Derangements: [[[4], 9], [[5], 44]], // subfactorial
  MotzkinPaths: [[[4], 9], [[5], 21]],
  SchroderPaths: [[[3], 22]], // large Schröder
};

export function checkAnchors(out: SelfcertResult): void {
  for (const [head, rows] of Object.entries(ANCHORS)) {
    const e = allEntries.find((x) => x.head === head);
    if (!e) continue;
    for (const [p, expected] of rows) {
      out.checks++;
      const got = e.count(p);
      if (got !== expected) out.fails.push(`ANCHOR ${head}(${p}) count ${got} ≠ known ${expected}`);
    }
  }
}

// CLI entry — full sweep. `import.meta.url` guard so importing this module (the test does) doesn't run it.
if (import.meta.url === `file://${process.argv[1]}`) {
  const nMax = Number(process.argv[2] ?? 9);
  const out = runSelfcert(nMax);
  checkAnchors(out);
  console.log(`selfcert: ${out.families} families, ${out.checks} checks, ${out.skipped.length} skipped (over cap)`);
  if (out.fails.length) {
    console.log(`\n${out.fails.length} FAILURES:`);
    for (const f of out.fails.slice(0, 50)) console.log("  ✗", f);
    process.exit(1);
  }
  console.log("✓ every family is a certified bijection onto its valid set");
}
