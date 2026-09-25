// The runner: sample the catalogue, report, and print the seed that replays it.
//
// Every property lives in `properties.ts`, which has no side effects and is unit-tested
// against deliberately broken kernels — because a harness that reports "0 failing" is only
// worth anything if it has been shown to fail on something.
//
//   vp node packages/symbols/combinatorics/collections/scripts/quickcheck.ts             # everything, fresh seed
//   vp node packages/symbols/combinatorics/collections/scripts/quickcheck.ts perm        # families matching "perm"
//   vp node packages/symbols/combinatorics/collections/scripts/quickcheck.ts perm 123456 # replay exactly
//   QUICKCHECK_POINTS=20 vp node …/quickcheck.ts                   # more points per family

import { allEntries } from "../src/families/index.ts";
import { check, checkFamily, type Failure, random, shrink } from "./properties.ts";

const POINTS = Number(process.env.QUICKCHECK_POINTS ?? 8);
const PARAM_CAP = Number(process.env.QUICKCHECK_PARAM_CAP ?? 7);

// Families backed by tableaux-plane.ts's `indexedFamily` engine: unrank/rank (and, for three of
// them, count itself) fully materialize every element of the family before answering. That
// file's own comment assumes sizes "stay small enough that full enumeration is cheap and
// safe" — an assumption PARAM_CAP (let alone the nightly deep sample's 9) blows past:
// GelfandTsetlin(5, 5) alone is 151,008 elements, GelfandTsetlin(9, 3) is 8.6M. Sampled at a
// much smaller cap so they're still exercised without materializing the whole family.
const FULL_ENUMERATION_FAMILIES = new Set([
  "SemistandardTableaux",
  "GelfandTsetlin",
  "AlternatingSignMatrices",
  "SkewPartitions",
  "SkewStandardTableaux",
  "PlanePartitions",
]);
const SMALL_PARAM_CAP = 4;

// ── the run ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const filter = args.find((argument) => !/^\d+$/.test(argument)) ?? "";
const seed = Number(args.find((argument) => /^\d+$/.test(argument)) ?? Date.now() % 1_000_000);
const draw = random(seed);

const families = allEntries.filter((entry) =>
  filter === "" ? true : entry.head.toLowerCase().includes(filter.toLowerCase()),
);

process.stdout.write(`quickcheck seed ${seed} — ${families.length} families, ${POINTS} points each\n`);
if (families.length === 0) {
  process.stdout.write(`no family matches ${JSON.stringify(filter)}\n`);
  process.exit(1);
}

const failures: Failure[] = [];
let checked = 0;

for (const entry of families) {
  const paramCap = FULL_ENUMERATION_FAMILIES.has(entry.head) ? SMALL_PARAM_CAP : PARAM_CAP;
  for (let attempt = 0; attempt < POINTS; attempt++) {
    const params = Array.from({ length: entry.paramCount }, () => Math.floor(draw() * (paramCap + 1)));
    let total: number;
    try {
      total = entry.count(params);
    } catch (error) {
      failures.push({
        family: entry.head,
        property: "count",
        params,
        rank: -1,
        detail: `count threw: ${String(error).slice(0, 120)}`,
      });
      continue;
    }
    if (!Number.isFinite(total) || total <= 0) continue; // an empty family proves nothing

    const familyFailure = checkFamily(entry, params, draw);
    if (familyFailure !== undefined) {
      failures.push(shrink(entry, familyFailure));
      break;
    }
    const rank = Math.floor(draw() * Math.min(total, 10_000));
    const failure = check(entry, params, rank);
    checked++;
    if (failure !== undefined) {
      failures.push(shrink(entry, failure));
      break;
    }
  }
}

process.stdout.write(`${checked} points checked, ${failures.length} families failing\n`);
for (const failure of failures) {
  process.stdout.write(
    `\n  ${failure.family}(${failure.params.join(", ")})${failure.rank >= 0 ? ` at rank ${failure.rank}` : ""}\n` +
      `    ${failure.property}: ${failure.detail}\n` +
      `    replay: vp node packages/symbols/combinatorics/collections/scripts/quickcheck.ts ${failure.family} ${seed}\n`,
  );
}

// Advisory: a fresh seed each run means a red result is a finding to triage, not a broken
// build. The exit code still reports it, so a deliberate run can be gated if we want one.
process.exit(failures.length > 0 ? 1 : 0);
