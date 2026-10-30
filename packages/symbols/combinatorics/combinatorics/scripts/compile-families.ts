// Compile every Epsil family's definitions (count, unrank, rank, valid) to JavaScript ahead of
// time, with compute-engine's own compiler, into
// collections/src/families/compiled-families.generated.js. Each entry carries the hash of the
// definitions it came from: at run time it is used only while the hash matches, so an edited
// family is compiled on first use until this is rerun. Operations the compiler can't take yet
// are left out, and interpreted; so are operations whose compiled code disagrees with the
// interpreter on a sample, which are listed so they are never compiled on first use either.
//
// The cross-checks are most of the cost, so on CI the families split by head across processes
// (FAMILY_SHARDS, default 3 there and 1 elsewhere), each keeping its own verdict memo. This file
// only coordinates; family-checks.ts, which loads the families, runs in the children.
//
//   vp node packages/symbols/combinatorics/combinatorics/scripts/compile-families.ts

import { type ChildProcess, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkers, verdictsFor } from "./verdicts.ts";
import { writeGenerated } from "./write-generated.ts";

const SHARDS = Number(process.env.FAMILY_SHARDS) || (process.env.CI ? 3 : 1);

/** Roughly what the dearest families' cold cross-checks cost, in seconds, on one core; every other
 *  family counts one. Only the split reads this, so a stale entry costs balance, never correctness;
 *  the shards log their times, so rebalance when one runs well past the others. */
const COST: Readonly<Record<string, number>> = {
  ParkingFunctions: 230,
  ZigzagCompositions: 120,
  BoxedPlanePartitions: 32,
  NonCrossingTrees: 22,
  CarlitzCompositions: 22,
  NonCrossingPartitions: 16,
  NonNestingPartitions: 16,
  PartCountBoundedCompositions: 14,
  BinaryTreeParentArrays: 8,
  GelfandTsetlin: 18,
  SemistandardTableaux: 14,
  SeparablePermutations: 13,
  SkewStandardTableaux: 6,
  NonCrossingCycleSupportPermutations: 5,
  SkewPartitions: 4,
  RootedUnlabeledTrees: 3,
  UnlabeledFreeTrees: 3,
};

/** Each head's shard: dearest first, each to the least loaded (so one head can't hold up the rest). */
function assignShards(heads: readonly string[], shards: number): Map<string, number> {
  const load = Array.from({ length: shards }, () => 0);
  const cost = (head: string): number => COST[head] ?? 1;
  const out = new Map<string, number>();
  for (const head of heads.toSorted((a, b) => cost(b) - cost(a) || (a < b ? -1 : 1))) {
    const shard = load.indexOf(Math.min(...load));
    load[shard]! += cost(head);
    out.set(head, shard);
  }
  return out;
}

/** One entry, as the generated module spells it, and what the summary line counts. */
interface Rendered {
  readonly head: string;
  readonly text: string;
  readonly compiled: number;
  readonly interpreted: readonly string[];
  readonly bigInterpreted: readonly string[];
}

interface Result {
  readonly entries: Rendered[];
  readonly defined: number;
}

if (process.argv[2] === "--shard") {
  const [, , , shard, shards, out] = process.argv;
  const { compiledFamilies, definedOperations, familyHeads, renderEntry } = await import("./family-checks.ts");
  const mine = assignShards(familyHeads(), Number(shards));
  const verdicts = verdictsFor(
    Number(shards) === 1 ? "compile-families" : `compile-families-${shard}of${shards}`,
    checkers.families,
  );
  const takes = (head: string): boolean => mine.get(head) === Number(shard);
  verdicts.plan(familyHeads().filter(takes));
  const entries = verdicts
    .settle(() => compiledFamilies(verdicts, takes))
    .map((e) => ({
      head: e.head,
      text: renderEntry(e),
      compiled: Object.keys(e.code).length,
      interpreted: e.interpreted,
      bigInterpreted: e.bigInterpreted,
    }));
  writeFileSync(out!, JSON.stringify({ entries, defined: definedOperations() } satisfies Result));
  verdicts.save();
} else {
  const children = new Set<ChildProcess>();
  const runShard = (shard: number, out: string): Promise<Result> =>
    new Promise((resolve, reject) => {
      const started = Date.now();
      const child = spawn("node", [fileURLToPath(import.meta.url), "--shard", String(shard), String(SHARDS), out], {
        stdio: "inherit",
      });
      children.add(child);
      child.on("error", reject);
      child.on("exit", (code) => {
        children.delete(child);
        if (code !== 0) return reject(new Error(`compile-families shard ${shard} exited with ${code}`));
        const result = JSON.parse(readFileSync(out, "utf8")) as Result;
        if (SHARDS > 1)
          console.log(
            `compile-families shard ${shard + 1}/${SHARDS}: ${result.entries.length} families, ${((Date.now() - started) / 1000).toFixed(0)}s`,
          );
        resolve(result);
      });
    });

  const scratch = mkdtempSync(join(tmpdir(), "compile-families-"));
  let results: Result[];
  try {
    results = await Promise.all(Array.from({ length: SHARDS }, (_, i) => runShard(i, join(scratch, `${i}.json`))));
  } finally {
    // A failed shard leaves its siblings running; stop them, and take the scratch directory with them.
    for (const child of children) child.kill();
    rmSync(scratch, { recursive: true, force: true });
  }

  const entries = results
    .flatMap((r) => r.entries)
    .toSorted((a, b) => (a.head < b.head ? -1 : a.head > b.head ? 1 : 0));
  const target = fileURLToPath(new URL("../collections/src/families/compiled-families.generated.js", import.meta.url));
  writeGenerated(
    target,
    `// GENERATED by scripts/compile-families.ts from the families' Epsil definitions, by
// compute-engine's JavaScript compiler. Do not edit: rerun the script. Each entry is used only
// while \`hash\` matches its definitions; see ./epsil.ts.
// A definition that ignores one of its inputs compiles to code that never reads it.
// A \`Join\` of single-element \`List\`s (a fixed head or tail spliced onto a filtered range, e.g.
// IntegerCompositions' boundaries) compiles to a single-element array spread.
/* eslint-disable no-unused-vars, unicorn/no-useless-spread */

export const COMPILED_FAMILIES = {
${entries.map((e) => e.text).join("\n")}
};
`,
  );
  const operations = entries.reduce((sum, e) => sum + e.compiled, 0);
  console.log(`${operations} of ${results[0]!.defined} family operations compiled`);
  for (const e of entries.filter((entry) => entry.interpreted.length > 0))
    console.log(`${e.head}: compiled ${e.interpreted.join(", ")} disagreed with the interpreter; left interpreted`);
  for (const e of entries.filter((entry) => entry.bigInterpreted.length > 0))
    console.log(
      `${e.head}: BigInt-compiled ${e.bigInterpreted.join(", ")} disagreed with the interpreter; left interpreted`,
    );
}
