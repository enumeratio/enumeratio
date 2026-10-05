// Skip a generation step whose inputs have not changed. A step's stamp is a hash of everything
// it reads: its own files, the dist of every workspace package it depends on (transitively), the
// other roots it names, the lockfile and compute-engine's version. It is kept in
// node_modules/.cache, so a fresh checkout (or a deleted output) always runs the step.

import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";

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

/** The `dist` directories of the workspace packages `dir` depends on, transitively. */
export function workspaceDists(dir: string): string[] {
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
      seen.set(name, join(dep, "dist"));
      visit(dep);
    }
  };
  visit(dir);
  return [...seen.values()];
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
}

/** A hash of everything the step reads. */
export function hashInputs({ dir, roots: own = [dir], skip = () => false }: StepInputs): string {
  const hash = createHash("sha256");
  const add = (label: string, data: string | Buffer): void => {
    hash.update(`${label}\0${data.length}\0`);
    hash.update(data);
  };
  const roots = [...own, ...workspaceDists(dir)];
  for (const root of roots) {
    for (const file of filesUnder(root, skip)) add(relative(dir, file), readFileSync(file));
  }
  const lock = lockfileOf(dir);
  add("lockfile", lock === "" ? "" : readFileSync(lock));
  add("compute-engine", engineVersion());
  add("node", process.version);
  return hash.digest("hex");
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
  await run();
  mkdirSync(dirname(file), { recursive: true });
  if (restore) outputs.forEach((o, i) => cpSync(o, copy(i), { recursive: true }));
  writeFileSync(file, hash);
  return true;
}

export interface Verdicts {
  /** `compute()`, or its answer from an earlier run on the same `parts`. */
  remember<T>(parts: unknown, compute: () => T): T;
  /** Keeps this run's answers, and only those, for the next run. */
  save(): void;
}

/** Every answer is computed, and none kept. */
export const noVerdicts: Verdicts = { remember: (_parts, compute) => compute(), save() {} };

/**
 * A memo of checks that are slow and pure in `parts` (a generator comparing compiled code with
 * the interpreter, say) so an edit to one definition re-checks only that one. Answers are
 * trusted only while `inputs` (what the checks run on: the interpreter's code, the dists it
 * lives in) hash as they did when the answers were made.
 */
export function verdictCache(name: string, inputs: StepInputs): Verdicts {
  const file = cacheFile(inputs.dir, `${name}.verdicts.json`);
  const env = hashInputs(inputs);
  let before: Record<string, unknown> = {};
  try {
    const saved = JSON.parse(readFileSync(file, "utf8")) as { env: string; answers: Record<string, unknown> };
    if (saved.env === env) before = saved.answers;
  } catch {
    // none yet, or unreadable: every check runs
  }
  const kept: Record<string, unknown> = {};
  return {
    remember<T>(parts: unknown, compute: () => T): T {
      const key = createHash("sha256").update(JSON.stringify(parts)).digest("hex");
      kept[key] = key in before ? before[key] : compute();
      return kept[key] as T;
    },
    save() {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify({ env, answers: kept }));
    },
  };
}
