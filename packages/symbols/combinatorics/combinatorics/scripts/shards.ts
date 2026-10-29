// Runs one compile step's cross-checks across processes. The checks are the cost and need no
// shared state, so a step splits its items by key into shards, each a child of the step's own
// script (`node script --shard i n out`) that hands back its result and the verdicts it
// learned; the parent folds them into the one memo and saves it. The memo is a single file
// whatever the shard count, so a run with another count (local 1, CI 3) reuses the same answers.

import { type ChildProcess, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { type SharedVerdicts, verdictsFor } from "./verdicts.ts";

/** Shards per step: COMPILE_SHARDS, else 3 on CI and 1 elsewhere. */
export const SHARDS = Number(process.env.COMPILE_SHARDS) || (process.env.CI ? 3 : 1);

/** A key's shard, stable across runs and unrelated to the order items are listed in. */
const shardOf = (key: string, shards: number): number =>
  createHash("sha256").update(key).digest().readUInt32BE(0) % shards;

interface Shard<T> {
  readonly result: T;
  readonly share: ReturnType<SharedVerdicts["share"]>;
}

/**
 * Runs `work` over the keys of one shard in each of `SHARDS` processes. Returns the results and
 * the verdicts (to `save`) in the parent, and undefined in a shard, which has written its own
 * result and has nothing more to do.
 */
export async function sharded<T>(
  script: string,
  step: string,
  checks: readonly string[],
  work: (verdicts: SharedVerdicts, mine: (key: string) => boolean) => T,
): Promise<{ results: T[]; verdicts: SharedVerdicts } | undefined> {
  const verdicts = verdictsFor(step, checks);
  if (process.argv[2] === "--shard") {
    const [, , , shard, shards, out] = process.argv;
    const result = work(verdicts, (key) => shardOf(key, Number(shards)) === Number(shard));
    writeFileSync(out!, JSON.stringify({ result, share: verdicts.share() } satisfies Shard<T>));
    return undefined;
  }
  if (SHARDS === 1) return { results: [work(verdicts, () => true)], verdicts };

  const children = new Set<ChildProcess>();
  const scratch = mkdtempSync(join(tmpdir(), "compile-shards-"));
  const run = (shard: number): Promise<Shard<T>> =>
    new Promise((resolve, reject) => {
      const out = join(scratch, `${shard}.json`);
      const started = Date.now();
      const child = spawn("node", [fileURLToPath(script), "--shard", String(shard), String(SHARDS), out], {
        stdio: "inherit",
      });
      children.add(child);
      child.on("error", reject);
      child.on("exit", (code) => {
        children.delete(child);
        if (code !== 0) return reject(new Error(`${step} shard ${shard} exited with ${code}`));
        console.log(`${step} shard ${shard + 1}/${SHARDS}: ${((Date.now() - started) / 1000).toFixed(0)}s`);
        resolve(JSON.parse(readFileSync(out, "utf8")) as Shard<T>);
      });
    });
  try {
    const shards = await Promise.all(Array.from({ length: SHARDS }, (_, i) => run(i)));
    for (const { share } of shards) verdicts.adopt(share);
    return { results: shards.map((s) => s.result), verdicts };
  } finally {
    // A failed shard leaves its siblings running; stop them, and take the scratch directory with them.
    for (const child of children) child.kill();
    rmSync(scratch, { recursive: true, force: true });
  }
}
