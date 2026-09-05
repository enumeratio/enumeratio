// Differential oracle for @enumeratio/math's RANK/UNRANK round-trips: a rank decoded and re-encoded must recover
// itself, and where a decode has an SQL twin the two must agree.
//
// The scalar TS == SQL half of this file has MOVED to packages/client/selfcert-engine.mts (#278 increment 6),
// which sweeps the same comparison driven by base_function_impl rather than by a hand-written loop per function —
// so a new implementation row is certified the moment it lands, and the sweep also locates each float64 twin's
// exactness frontier. What stays here is the part that is not an engine differential at all: the bijection
// round-trips, whose SQL side is dispatched generically through unrank(<collection>, r) rather than being a
// separately named identity (see identities.sql's exclusion note).
//
//   node --import tsx selfcert-math.mts
//
// @enumeratio/math itself stays zero-dependency; this script is the one place in the package that boots the SQL
// core (via @enumeratio/data/node, a devDependency) to check TS against it.

import { bootCore } from "@enumeratio/data/node";
import * as M from "./src/index.js";

const pg = await bootCore();
const q = async (sql: string): Promise<string[][]> => (await pg.query(sql)).rows.map((r: any) => Object.values(r).map(String));

let checked = 0;
const mismatches: string[] = [];

function record(label: string, expected: unknown, got: unknown) {
  checked++;
  if (String(expected) !== String(got)) mismatches.push(`${label}: SQL=${expected} TS=${got}`);
}

// ---- integer compositions (gap-cut bijection) ----
for (let n = 0; n <= 12; n++) {
  const total = n >= 1 ? 1 << (n - 1) : 1;
  for (let mask = 0; mask < total; mask++) {
    const [[sql]] = await q(`SELECT array_to_string((composition_from_mask(${n},${mask}::bigint)).parts, ',')`);
    record(`composition_from_mask(${n},${mask})`, sql, M.composition_from_mask(n, mask).join(","));
    // and the inverse round-trips back to the same mask (no separate SQL rank fn to twin against — see module header)
    record(`composition_rank(inverse of mask ${mask}, n=${n})`, mask, M.composition_rank(M.composition_from_mask(n, mask)));
  }
}

// ---- permutations (Lehmer decode, direct bare-callable SQL twin) ----
for (let n = 0; n <= 6; n++) {
  const N = M.factorial(n);
  for (let r = 0; r < N; r++) {
    const [[img]] = await q(`SELECT array_to_string((permutation_unrank_lex(${n},${r})).image, ',')`);
    const tsPerm = M.permutation_unrank(n, r);
    record(`permutation_unrank(${n},${r})`, img, tsPerm.join(","));
    // round-trip: TS rank of the (SQL-matching) TS unrank result must recover r — permutation_rank has no
    // bare SQL twin, so this is its differential (see permutations.ts header)
    record(`permutation_rank(round-trip n=${n} r=${r})`, r, M.permutation_rank(tsPerm));
    // lehmer_code: SQL's to_inversion(...).code drops the always-0 trailing entry; TS keeps it
    const [[code]] = await q(`SELECT array_to_string((to_inversion(permutation_unrank_lex(${n},${r}))).code, ',')`);
    record(`lehmer_code(${n},${r})`, code, M.lehmer_code(tsPerm).slice(0, -1).join(","));
    const [[inv]] = await q(`SELECT perm_inversions(permutation_unrank_lex(${n},${r}))::text`);
    record(`inversions(${n},${r})`, inv, M.inversions(tsPerm));
  }
}

// ---- permutation statistics (stirling1, eulerianA) ----
for (let n = 0; n <= 15; n++) {
  for (let k = -1; k <= n + 1; k++) {
    const [[sql]] = await q(`SELECT stirling_first_unsigned(${n},${k})::text`);
    record(`stirling1(${n},${k})`, sql, M.stirling1(n, k));
  }
}
for (let n = 0; n <= 15; n++) {
  for (let k = -1; k <= n + 1; k++) {
    const [[sql]] = await q(`SELECT eulerian_number(${n},${k})::text`);
    record(`eulerianA(${n},${k})`, sql, M.eulerianA(n, k));
  }
}

// ---- integer_partitions rank/unrank (generic dispatch — no bare SQL fn) ----
const ipNotation = (parts: number[]) => (parts.length ? parts.join("+") : "0");
for (let n = 0; n <= 12; n++) {
  const total = M.partition_number(n);
  for (let r = 0; r < total; r++) {
    const [[sql]] = await q(`SELECT notation((unrank(integer_partitions(${n}), ${r})).value)`);
    const p = M.integerPartitionUnrank(n, r);
    record(`integerPartitionUnrank(${n},${r})`, sql, ipNotation(p));
    record(`integerPartitionRank(round-trip n=${n} r=${r})`, r, M.integerPartitionRank(p, n));
  }
}

// ---- k_part_partitions rank/unrank (generic dispatch — no bare SQL fn) ----
for (let n = 0; n <= 10; n++) {
  for (let k = 1; k <= n; k++) {
    const [[cnt]] = await q(`SELECT k_part_partition_count(${n},${k})::text`);
    record(`integerPartitionKCount(${n},${k})`, cnt, M.integerPartitionKCount(n, k));
    const total = M.integerPartitionKCount(n, k);
    for (let r = 0; r < total; r++) {
      const [[sql]] = await q(`SELECT notation((unrank(k_part_partitions(${n},${k}), ${r})).value)`);
      const p = M.integerPartitionKUnrank(n, k, r);
      record(`integerPartitionKUnrank(${n},${k},${r})`, sql, ipNotation(p));
      record(`integerPartitionKRank(round-trip n=${n} k=${k} r=${r})`, r, M.integerPartitionKRank(p, n));
    }
  }
}

// ---- set_partitions rank/unrank via RGS (generic dispatch — no bare SQL fn) ----
for (let n = 0; n <= 7; n++) {
  const total = M.bell(n);
  for (let r = 0; r < total; r++) {
    const [[sql]] = await q(`SELECT notation((unrank(set_partitions(${n}), ${r})).value)`);
    const w = M.rgsUnrank(n, r);
    record(`rgsUnrank(${n},${r})`, sql, w.join(""));
    record(`rgsRank(round-trip n=${n} r=${r})`, r, M.rgsRank(w));
  }
}

// ---- set_partitions_into_k_blocks rank/unrank (generic dispatch — no bare SQL fn) ----
for (let n = 0; n <= 7; n++) {
  for (let k = 1; k <= n; k++) {
    const total = M.stirling_second(n, k);
    for (let r = 0; r < total; r++) {
      const [[sql]] = await q(`SELECT notation((unrank(set_partitions_into_k_blocks(${n},${k}), ${r})).value)`);
      const w = M.setPartitionsIntoKBlocksUnrank(n, k, r);
      record(`setPartitionsIntoKBlocksUnrank(${n},${k},${r})`, sql, w.join(""));
      record(`setPartitionsIntoKBlocksRank(round-trip n=${n} k=${k} r=${r})`, r, M.setPartitionsIntoKBlocksRank(w, k));
    }
  }
}

// ---- set_compositions rank/unrank (generic dispatch — no bare SQL fn; different carrier/order than the
// numbers-repo's mask-based SetComposition, see set_compositions.ts header) ----
const scNotation = (labels: number[]) => {
  const byLabel = new Map<number, number[]>();
  labels.forEach((l, i) => {
    if (!byLabel.has(l)) byLabel.set(l, []);
    byLabel.get(l)!.push(i + 1);
  });
  return [...byLabel.keys()].sort((a, b) => a - b).map((k) => byLabel.get(k)!.join(",")).join("|");
};
for (let n = 0; n <= 5; n++) {
  const total = M.fubini(n);
  for (let r = 0; r < total; r++) {
    const [[sql]] = await q(`SELECT notation((unrank(set_compositions(${n}), ${r})).value)`);
    const labels = M.setCompositionUnrank(n, r);
    record(`setCompositionUnrank(${n},${r})`, sql, scNotation(labels));
    record(`setCompositionRank(round-trip n=${n} r=${r})`, r, M.setCompositionRank(labels, n));
  }
}
// n=6 sampled (fubini(6)=4683 — full range is overkill; boundary + a spread of ranks)
{
  const n = 6;
  const total = M.fubini(n);
  const samples = new Set([0, 1, total - 2, total - 1]);
  for (let r = 0; r < total; r += 37) samples.add(r);
  for (const r of [...samples].sort((a, b) => a - b)) {
    const [[sql]] = await q(`SELECT notation((unrank(set_compositions(${n}), ${r})).value)`);
    const labels = M.setCompositionUnrank(n, r);
    record(`setCompositionUnrank(${n},${r})`, sql, scNotation(labels));
    record(`setCompositionRank(round-trip n=${n} r=${r})`, r, M.setCompositionRank(labels, n));
  }
}

await pg.close();

console.log(`checked ${checked} cases across ${Object.keys(M).length} exports`);
if (mismatches.length) {
  console.error(`\n✗ ${mismatches.length} mismatch(es):`);
  for (const m of mismatches.slice(0, 50)) console.error(`  ${m}`);
  process.exit(1);
}
console.log("✓ all TS primitives agree with their SQL twins");
