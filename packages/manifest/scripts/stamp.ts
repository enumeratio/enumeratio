// Skip a generation step whose inputs have not changed. A step's stamp is a hash of everything
// it reads: its own files, the dist of every workspace package it depends on (transitively), the
// other roots it names, the lockfile and compute-engine's version. It is kept in
// node_modules/.cache, so a fresh checkout (or a deleted output) always runs the step.

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";

const SCOPE = "@enumeratio/";
const SKIPPED = new Set(["node_modules", "dist", ".git"]);

/** Every file under `root` (itself, if a file), in a stable order, minus `skip`ped ones. */
function filesUnder(root: string, skip: (path: string) => boolean): string[] {
  if (!existsSync(root)) return [];
  if (!statSync(root).isDirectory()) return [root];
  const out: string[] = [];
  for (const name of readdirSync(root).toSorted()) {
    const path = join(root, name);
    if (SKIPPED.has(name) || skip(path)) continue;
    out.push(...filesUnder(path, skip));
  }
  return out;
}

/** The `dist` directories of the workspace packages `dir` depends on, transitively; with `from`,
 *  of those packages (full names, resolved from `dir`) and what they depend on instead. */
export function workspaceDists(dir: string, omit: readonly string[] = [], from?: readonly string[]): string[] {
  const seen = new Map<string, string>();
  const visit = (home: string): void => {
    const pkg = JSON.parse(readFileSync(join(home, "package.json"), "utf8")) as Record<string, Record<string, string>>;
    const names = new Set(
      ["dependencies", "devDependencies", "peerDependencies"].flatMap((field) => Object.keys(pkg[field] ?? {})),
    );
    for (const name of [...names].filter((n) => n.startsWith(SCOPE)).toSorted()) {
      if (seen.has(name)) continue;
      let dep: string;
      try {
        dep = realpathSync(join(home, "node_modules", name));
      } catch {
        continue; // not installed here (a dev-only dependency, say)
      }
      seen.set(name, omit.includes(name) ? "" : join(dep, "dist"));
      visit(dep);
    }
  };
  const enter = (name: string): void => {
    if (seen.has(name)) return;
    const dep = realpathSync(join(dir, "node_modules", name));
    seen.set(name, omit.includes(name) ? "" : join(dep, "dist"));
    visit(dep);
  };
  if (from === undefined) visit(dir);
  else for (const name of from) enter(name);
  return [...seen.values()].filter((dist) => dist !== "");
}

function lockfileOf(dir: string): string {
  for (let d = dir; d !== dirname(d); d = dirname(d))
    if (existsSync(join(d, "pnpm-lock.yaml"))) return join(d, "pnpm-lock.yaml");
  return "";
}

/** compute-engine's version; its `exports` hide `package.json`, so it is found from the entry. */
function engineVersion(): string {
  let d = dirname(createRequire(import.meta.url).resolve("@cortex-js/compute-engine"));
  while (!existsSync(join(d, "package.json"))) d = dirname(d);
  return (JSON.parse(readFileSync(join(d, "package.json"), "utf8")) as { version: string }).version;
}

export interface StepInputs {
  /** The package directory, which the stamp and the dists of its dependencies are found from. */
  readonly dir: string;
  /** The files and directories the step reads (default: the package directory), minus dist and
   *  node_modules. */
  readonly roots?: readonly string[];
  /** Files the step writes, which must not count as its inputs. */
  readonly skip?: (path: string) => boolean;
  /** Workspace packages (full names) whose dist is left out of the hash; the caller names in
   *  `roots` what of them it reads. For a dist built from every package's records, which any
   *  record edit changes. */
  readonly omitDists?: readonly string[];
  /** Workspace packages (full names) the step imports. Their dists, and those of what they depend
   *  on, are hashed instead of every dist `dir` depends on: a dependency the step never loads
   *  (and nothing it loads imports) cannot change what it computes. */
  readonly imports?: readonly string[];
}

/** A hash of everything the step reads. */
export function hashInputs({
  dir,
  roots: own = [dir],
  skip = () => false,
  omitDists = [],
  imports,
}: StepInputs): string {
  const hash = createHash("sha256");
  const add = (label: string, data: string | Buffer): void => {
    hash.update(`${label}\0${data.length}\0`);
    hash.update(data);
  };
  const roots = [...own, ...workspaceDists(dir, omitDists, imports)];
  for (const root of roots) {
    for (const file of filesUnder(root, skip)) add(relative(dir, file), readFileSync(file));
  }
  const lock = lockfileOf(dir);
  add("lockfile", lock === "" ? "" : readFileSync(lock));
  add("compute-engine", engineVersion());
  add("node", process.version);
  return hash.digest("hex");
}

/** `hashInputs` in two: what the step's own code and config are (`code`, with the lockfile and
 *  Node), and what it runs on (`engine`: the dists it imports, compute-engine's version). A memo
 *  whose engine alone moved holds answers that are probably still right (see `verdictCache`). */
export function hashParts({ dir, roots: own = [dir], skip = () => false, omitDists = [], imports }: StepInputs): {
  code: string;
  engine: string;
} {
  const code = createHash("sha256");
  const engine = createHash("sha256");
  const add = (hash: ReturnType<typeof createHash>, label: string, data: string | Buffer): void => {
    hash.update(`${label}\0${data.length}\0`);
    hash.update(data);
  };
  for (const root of own) for (const file of filesUnder(root, skip)) add(code, relative(dir, file), readFileSync(file));
  for (const root of workspaceDists(dir, omitDists, imports))
    for (const file of filesUnder(root, skip)) add(engine, relative(dir, file), readFileSync(file));
  const lock = lockfileOf(dir);
  add(code, "lockfile", lock === "" ? "" : readFileSync(lock));
  add(code, "node", process.version);
  add(engine, "compute-engine", engineVersion());
  return { code: code.digest("hex"), engine: engine.digest("hex") };
}

/**
 * The directory tools/ci/dist-cache.ts keeps its tarballs in (`$DIST_CACHE_DIR`, else the
 * clone's shared git directory). A step's outputs are kept there too, under the hash of its
 * inputs, so a fresh worktree restores them instead of running a step that takes minutes.
 */
function sharedDir(repo: string): string | undefined {
  const set = process.env.DIST_CACHE_DIR;
  if (set) return isAbsolute(set) ? set : resolve(repo, set);
  try {
    const common = execFileSync("git", ["rev-parse", "--git-common-dir"], { cwd: repo, encoding: "utf8" }).trim();
    return join(resolve(repo, common), "dist-cache");
  } catch {
    return undefined; // not a git checkout: no shared store
  }
}

/** The step's outputs, tarred relative to the repository root, under its input hash. */
function sharedStep(dir: string, name: string, hash: string, outputs: readonly string[]) {
  const lock = lockfileOf(dir);
  const store = lock === "" ? undefined : sharedDir(dirname(lock));
  if (store === undefined) return undefined;
  const repo = dirname(lock);
  const inside = outputs.map((o) => relative(repo, o));
  if (inside.some((p) => p.startsWith(".."))) return undefined;
  const id = createHash("sha256").update(`${name}\0${hash}`).digest("hex").slice(0, 32);
  const tar = join(store, `step-${id}.tar`);
  return {
    restore(): boolean {
      if (!existsSync(tar)) return false;
      for (const o of outputs) rmSync(o, { recursive: true, force: true });
      if (spawnSync("tar", ["-xf", tar, "-C", repo]).status !== 0) return false;
      const now = new Date();
      utimesSync(tar, now, now);
      return outputs.every((o) => existsSync(o));
    },
    save(): void {
      mkdirSync(store, { recursive: true });
      const tmp = join(store, `.tmp-${process.pid}-step-${id}.tar`);
      if (spawnSync("tar", ["-cf", tmp, "-C", repo, ...inside]).status === 0) renameSync(tmp, tar);
      else rmSync(tmp, { force: true });
    },
  };
}

const cacheFile = (dir: string, name: string): string => join(dir, "node_modules", ".cache", "enumeratio", name);

/** Steps that share one `inputs` object share one hash, taken when the first of them starts. */
const hashes = new WeakMap<StepInputs, string>();

/**
 * Runs `run` unless a stamp from an earlier run matches the inputs' hash and every `outputs`
 * path still exists; the stamp is written only after `run` succeeds. With `restore`, the outputs
 * are also copied beside the stamp, so a later step that wipes them (a `dist` clean) does not
 * force a rerun.
 */
export async function cached(
  name: string,
  inputs: StepInputs,
  outputs: readonly string[],
  run: () => Promise<void> | void,
  { restore = false }: { readonly restore?: boolean } = {},
): Promise<boolean> {
  const file = cacheFile(inputs.dir, `${name}.stamp`);
  const copy = (i: number): string => cacheFile(inputs.dir, `${name}.out${i}`);
  if (!hashes.has(inputs)) hashes.set(inputs, hashInputs(inputs));
  const hash = hashes.get(inputs)!;
  if (existsSync(file) && readFileSync(file, "utf8") === hash) {
    if (outputs.every((o) => existsSync(o))) return false;
    if (restore && outputs.every((_, i) => existsSync(copy(i)))) {
      outputs.forEach((o, i) => cpSync(copy(i), o, { recursive: true }));
      return false;
    }
  }
  const shared = sharedStep(inputs.dir, name, hash, outputs);
  const fromShared = shared?.restore() === true;
  if (!fromShared) await run();
  // An edit while `run` ran leaves outputs that match neither hash: record nothing, so the next run reruns.
  if (!fromShared && hashInputs(inputs) !== hash) {
    hashes.delete(inputs);
    return true;
  }
  mkdirSync(dirname(file), { recursive: true });
  if (restore) outputs.forEach((o, i) => cpSync(o, copy(i), { recursive: true }));
  writeFileSync(file, hash);
  if (!fromShared) shared?.save();
  return !fromShared;
}

export interface Verdicts {
  /** `compute()`, or its answer from an earlier run on the same `parts`. `label` names the item
   *  (a definition's signature) for the sample and the cost record. */
  remember<T>(parts: unknown, compute: () => T, label?: string): T;
  /** Declares every item this step checks, so a run on a moved engine can sample them. */
  plan(labels: readonly string[]): void;
  /** What each label's last check took, in ms (kept across engine changes). */
  costs(): Readonly<Record<string, number>>;
  /** Whether a sampled re-check came out unlike the answer it was carried from. */
  diverged(): boolean;
  /** Runs `work`; on a divergence, re-checks everything and runs it again. */
  settle<T>(work: () => T): T;
  /** Re-check everything from here on (a divergence elsewhere, say). */
  escalate(): void;
  /** Keeps this run's answers, and only those, for the next run. */
  save(): void;
  /** This run's answers and counts, for the process that saves them (a shard hands them up). */
  share(): VerdictShare;
  /** Folds a shard's `share` into this run. */
  adopt(share: VerdictShare): void;
}

/** What one process learned, in a form that crosses a process boundary as JSON. */
export interface VerdictShare {
  readonly answers: Record<string, unknown>;
  readonly verified: Record<string, string>;
  readonly costs: Record<string, number>;
  readonly hits: number;
  readonly misses: number;
  readonly carried: number;
  readonly diverged: boolean;
}

/** Every answer is computed, and none kept. */
export const noVerdicts: Verdicts = {
  remember: (_parts, compute) => compute(),
  plan() {},
  costs: () => ({}),
  diverged: () => false,
  settle: (work) => work(),
  escalate() {},
  save() {},
  share: () => ({ answers: {}, verified: {}, costs: {}, hits: 0, misses: 0, carried: 0, diverged: false }),
  adopt() {},
};

/**
 * Where a step's verdicts live: in the shared store when `$DIST_CACHE_DIR` names one (CI carries
 * it from run to run, so a fresh runner re-checks only what changed), else beside the stamps.
 */
function verdictFile(dir: string, name: string): string {
  const lock = lockfileOf(dir);
  if (process.env.DIST_CACHE_DIR && lock !== "") {
    const repo = dirname(lock);
    const id = createHash("sha256")
      .update(`${relative(repo, dir)}\0${name}`)
      .digest("hex")
      .slice(0, 32);
    return join(sharedDir(repo)!, `verdicts-${id}.json`);
  }
  return cacheFile(dir, `${name}.verdicts.json`);
}

/** Whether to re-check everything: the nightly deep run, or RECHECK_ALL=1. */
export const recheckAll = (): boolean => process.env.DEEP_TESTS === "1" || process.env.RECHECK_ALL === "1";

/** The share of a step's items (at least `SAMPLE_MIN`) a run re-checks when only the engine
 *  moved. A miscompile from an engine change shows on many definitions at once, so a tenth finds
 *  it; the nightly run re-checks the rest. Engines differ in which tenth, so successive changes
 *  cover more. */
export const SAMPLE_FRACTION = 0.1;
export const SAMPLE_MIN = 3;

/** An answer a carry may stand in for: a pass, never a disagreement (which decides what the
 *  generated file leaves interpreted, so is always re-checked). */
const passed = (answer: unknown): boolean => answer === true || (Array.isArray(answer) && answer.length === 0);

interface Memo {
  code: string;
  engine: string;
  answers: Record<string, unknown>;
  /** The engine (a prefix of its hash) each answer was last checked on; one not checked on the
   *  current engine is carried. */
  verified: Record<string, string>;
  costs: Record<string, number>;
}

const tagOf = (engine: string): string => engine.slice(0, 12);

/** A saved memo's answers under `code`, each with the engine it was checked on. */
function readMemo(file: string, code: string): { memo: Partial<Memo>; usable: boolean } {
  const memo = JSON.parse(readFileSync(file, "utf8")) as Partial<Memo>;
  const usable = memo.code === code && memo.answers !== undefined && memo.engine !== undefined;
  if (usable) {
    memo.verified ??= {};
    // An answer with no record of its engine was made on the one the memo names.
    for (const key of Object.keys(memo.answers!)) memo.verified[key] ??= tagOf(memo.engine!);
  }
  return { memo, usable };
}

/**
 * A memo of checks that are slow and pure in `parts` (a generator comparing compiled code with
 * the interpreter, say) so an edit to one definition re-checks only that one. Answers are
 * trusted while the step's code, the lockfile and Node (`hashParts`' `code`) are as they were
 * when the answers were made, and:
 *   - the engine (dists, compute-engine) is the same: reused;
 *   - the engine moved: a deterministic sample of the step's items is re-checked and the other
 *     passes are carried, marked as not checked on this engine. A sampled answer that comes out
 *     differently is a divergence, and `settle` / the sharder re-check everything.
 * A definition whose `parts` changed has no answer, so is always checked, and `recheckAll()`
 * checks everything.
 */
export function verdictCache(name: string, inputs: StepInputs): Verdicts {
  const file = verdictFile(inputs.dir, name);
  const { code, engine } = hashParts(inputs);
  const tag = tagOf(engine);
  let full = recheckAll();
  const before: Memo = { code, engine, answers: {}, verified: {}, costs: {} };
  // Why answers were set aside, if they were.
  let discarded = "";
  try {
    const { memo, usable } = readMemo(file, code);
    before.costs = memo.costs ?? {};
    if (usable) Object.assign(before, { answers: memo.answers, verified: memo.verified });
    else discarded = `code changed (${(memo.code ?? "none").slice(0, 8)} -> ${code.slice(0, 8)})`;
  } catch (error) {
    discarded = (error as NodeJS.ErrnoException).code === "ENOENT" ? `no memo at ${basename(file)}` : "memo unreadable";
  }
  let kept: Record<string, unknown> = {};
  let verified: Record<string, string> = {};
  let costs: Record<string, number> = {};
  let sample = new Set<string>();
  let hits = 0;
  let misses = 0;
  let carried = 0;
  let diverged = false;
  return {
    plan(labels) {
      const ranked = labels
        .map((label) => [createHash("sha256").update(`${engine}\0${label}`).digest("hex"), label] as const)
        .toSorted((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
      const n = Math.min(labels.length, Math.max(SAMPLE_MIN, Math.ceil(labels.length * SAMPLE_FRACTION)));
      sample = new Set(ranked.slice(0, n).map(([, label]) => label));
    },
    costs: () => before.costs,
    diverged: () => diverged,
    escalate() {
      full = true;
      kept = {};
      verified = {};
      costs = {};
      hits = misses = carried = 0;
      diverged = false;
    },
    settle<T>(work: () => T): T {
      const result = work();
      if (!diverged || full) return result;
      console.log(`verdicts ${name}: a sampled re-check differed; re-checking everything`);
      this.escalate();
      return work();
    },
    remember<T>(parts: unknown, compute: () => T, label?: string): T {
      const key = createHash("sha256").update(JSON.stringify(parts)).digest("hex");
      const have = !full && key in before.answers;
      if (have && before.verified[key] === tag) {
        hits++;
        kept[key] = before.answers[key];
        verified[key] = tag;
        return kept[key] as T;
      }
      // Carry only an unchecked pass of a labelled item outside the sample; anything we are
      // unsure of is checked.
      if (have && passed(before.answers[key]) && label !== undefined && !sample.has(label)) {
        hits++;
        carried++;
        kept[key] = before.answers[key];
        verified[key] = before.verified[key]!;
        return kept[key] as T;
      }
      misses++;
      const started = Date.now();
      const answer = compute();
      if (label !== undefined) costs[label] = Date.now() - started;
      if (have && JSON.stringify(answer) !== JSON.stringify(before.answers[key])) diverged = true;
      kept[key] = answer;
      verified[key] = tag;
      return answer;
    },
    share: () => ({ answers: kept, verified, costs, hits, misses, carried, diverged }),
    adopt(share) {
      Object.assign(kept, share.answers);
      Object.assign(verified, share.verified);
      Object.assign(costs, share.costs);
      hits += share.hits;
      misses += share.misses;
      carried += share.carried;
      diverged ||= share.diverged;
    },
    save() {
      // Answers an earlier run left under the same code stay: a key names the definition it
      // checked, so a changed definition never matches one. Their engine record stays too, so
      // a carried answer is still marked unchecked.
      let answers = kept;
      let marks = verified;
      let times = { ...before.costs, ...costs };
      try {
        const { memo, usable } = readMemo(file, code);
        if (usable) {
          answers = pruned({ ...memo.answers, ...kept }, kept);
          marks = { ...memo.verified, ...verified };
        }
        times = { ...memo.costs, ...times };
      } catch {
        // nothing to merge
      }
      marks = Object.fromEntries(Object.entries(marks).filter(([k]) => k in answers));
      mkdirSync(dirname(file), { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      writeFileSync(tmp, JSON.stringify({ code, engine, answers, verified: marks, costs: times }));
      renameSync(tmp, file);
      console.log(
        `verdicts ${name}: ${hits} reused` +
          (carried > 0 ? ` (${carried} carried, not checked on this engine)` : "") +
          `, ${misses} checked` +
          (discarded === "" ? "" : `; memo discarded: ${discarded}`),
      );
    },
  };
}

/** The most answers a memo keeps: this run's, then the newest of the rest. */
const MAX_ANSWERS = 50_000;

function pruned(all: Record<string, unknown>, mine: Record<string, unknown>): Record<string, unknown> {
  const keys = Object.keys(all);
  if (keys.length <= MAX_ANSWERS) return all;
  const out: Record<string, unknown> = { ...mine };
  // Insertion order: the file's older answers come first, so the newest are last.
  for (const k of keys.toReversed()) {
    if (Object.keys(out).length >= MAX_ANSWERS) break;
    if (!(k in out)) out[k] = all[k];
  }
  return out;
}
