#!/usr/bin/env node
// Builds workspace packages, restoring a package's build outputs from a content-addressed cache
// when nothing it reads has changed.
//
//   node tools/ci/dist-cache.ts build [name…]   build the named packages and what they read (default: all but web)
//   node tools/ci/dist-cache.ts keys  [name…]   print each build unit's key
//
// A unit is a package, or a set of packages that depend on each other in a cycle (built together).
// Its key hashes the files of its packages (tracked, plus untracked and not ignored: never the
// gitignored build outputs), the keys of the units it reads, and the inputs every build shares.
// What it saves is every gitignored file under its packages' directories, so generated data
// (anything a build writes and git ignores) is picked up without being listed.
//
// The cache lives in $DIST_CACHE_DIR, else in the repository's shared git directory, so every
// worktree of a clone shares it. CI points it at a directory `actions/cache` carries.

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { availableParallelism } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { closure, git, loadWorkspace, root, type Pkg } from "./workspace.ts";

/** Bump when what the key covers or what is saved changes. */
const KEY_VERSION = 1;
const WEB = "@enumeratio/web";
const MAX_AGE_DAYS = 14;
const MAX_BYTES = 3 * 1024 ** 3;

/** Files every package build may read. */
const SHARED = ["pnpm-lock.yaml", "package.json", "pnpm-workspace.yaml", "tsconfig.json", "vite.config.ts"];

/** Records and manifests that the generators read across packages (manifest, reference). */
const SCANNED = /(?:^|\/)(?:reference\/|package\.json$)/;
const SCANNERS = ["@enumeratio/manifest", "@enumeratio/reference"];

function cacheDir(): string {
  const set = process.env.DIST_CACHE_DIR;
  if (set) return isAbsolute(set) ? set : resolve(root, set);
  return join(resolve(root, git("rev-parse", "--git-common-dir").trim()), "dist-cache");
}

/** Repo-relative path → content hash, for every file a build could read. */
function hashFiles(): Map<string, string> {
  const hashes = new Map<string, string>();
  for (const line of git("ls-files", "-s", "-z").split("\0")) {
    const m = /^\d+ ([0-9a-f]+) \d\t(.*)$/.exec(line);
    if (m) hashes.set(m[2]!, m[1]!);
  }
  const dirty = [
    ...git("ls-files", "-m", "-z").split("\0"),
    ...git("ls-files", "-o", "--exclude-standard", "-z").split("\0"),
  ];
  for (const path of dirty) {
    if (!path) continue;
    const file = join(root, path);
    if (!existsSync(file)) hashes.delete(path);
    else hashes.set(path, createHash("sha1").update(readFileSync(file)).digest("hex"));
  }
  for (const path of git("ls-files", "-d", "-z").split("\0")) if (path) hashes.delete(path);
  return hashes;
}

interface Unit {
  readonly id: string;
  readonly members: Pkg[];
  /** Ids of the units this one reads. */
  readonly deps: Set<string>;
}

/** Strongly connected components (Tarjan), so a dependency cycle builds as one unit. */
function units(pkgs: Map<string, Pkg>, names: Set<string>): Map<string, Unit> {
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const unitOf = new Map<string, string>();
  const out = new Map<string, Unit>();
  let counter = 0;
  const visit = (n: string): void => {
    index.set(n, counter);
    low.set(n, counter++);
    stack.push(n);
    onStack.add(n);
    for (const d of pkgs.get(n)!.deps) {
      if (!names.has(d)) continue;
      if (!index.has(d)) {
        visit(d);
        low.set(n, Math.min(low.get(n)!, low.get(d)!));
      } else if (onStack.has(d)) low.set(n, Math.min(low.get(n)!, index.get(d)!));
    }
    if (low.get(n) === index.get(n)) {
      const members: Pkg[] = [];
      for (let m = stack.pop()!; ; m = stack.pop()!) {
        onStack.delete(m);
        members.push(pkgs.get(m)!);
        if (m === n) break;
      }
      members.sort((a, b) => a.name.localeCompare(b.name));
      const id = members.map((m) => m.name).join("+");
      for (const m of members) unitOf.set(m.name, id);
      out.set(id, { id, members, deps: new Set() });
    }
  };
  for (const n of [...names].toSorted()) if (!index.has(n)) visit(n);
  for (const u of out.values())
    for (const m of u.members)
      for (const d of m.deps) {
        const target = unitOf.get(d);
        if (target !== undefined && target !== u.id) u.deps.add(target);
      }
  return out;
}

function computeKeys(all: Map<string, Pkg>, unitMap: Map<string, Unit>): Map<string, string> {
  const files = hashFiles();
  const shared = createHash("sha1");
  shared.update(`${KEY_VERSION} ${process.versions.node.split(".")[0]} ${process.platform} ${process.arch}\n`);
  for (const f of SHARED) shared.update(`${f} ${files.get(f) ?? ""}\n`);

  const scanned = createHash("sha1");
  const perPkg = new Map<string, string[]>();
  const dirs = [...all.values()].toSorted((a, b) => b.dir.length - a.dir.length);
  for (const [path, hash] of [...files].toSorted(([a], [b]) => (a < b ? -1 : 1))) {
    if (SCANNED.test(path)) scanned.update(`${path} ${hash}\n`);
    const pkg = dirs.find((p) => path.startsWith(`${p.dir}/`));
    if (pkg === undefined) continue;
    let list = perPkg.get(pkg.name);
    if (list === undefined) perPkg.set(pkg.name, (list = []));
    list.push(`${path} ${hash}`);
  }
  const scanHash = scanned.digest("hex");
  // Whoever reads the whole repo's records: the scanners, and every package built on them.
  const readsRecords = closure(SCANNERS, (n) => [...all.values()].filter((p) => p.deps.has(n)).map((p) => p.name));

  const keys = new Map<string, string>();
  const keyOf = (id: string): string => {
    const known = keys.get(id);
    if (known !== undefined) return known;
    const unit = unitMap.get(id)!;
    const h = createHash("sha256").update(shared.copy().digest("hex"));
    for (const m of unit.members) {
      h.update(`\n[${m.name}]\n${(perPkg.get(m.name) ?? []).join("\n")}`);
      if (readsRecords.has(m.name)) h.update(`\nscan ${scanHash}`);
    }
    for (const d of [...unit.deps].toSorted()) h.update(`\ndep ${d} ${keyOf(d)}`);
    const key = h.digest("hex").slice(0, 32);
    keys.set(id, key);
    return key;
  };
  for (const id of unitMap.keys()) keyOf(id);
  return keys;
}

/** Gitignored files under a unit's package dirs, as repo-relative paths (ignored directories whole). */
function outputsOf(unit: Unit): string[] {
  const found: string[] = [];
  for (const m of unit.members) {
    const listed = git("ls-files", "-o", "-i", "--exclude-standard", "--directory", "-z", "--", m.dir);
    for (const p of listed.split("\0")) if (p && !p.split("/").includes("node_modules")) found.push(p);
  }
  return found;
}

function run(cmd: string, args: string[], opts: { cwd?: string; capture?: boolean } = {}): Promise<string> {
  return new Promise((done, fail) => {
    const child = spawn(cmd, args, { cwd: opts.cwd ?? root, stdio: ["ignore", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    child.stdout.on("data", (c: Buffer) => chunks.push(c));
    child.stderr.on("data", (c: Buffer) => chunks.push(c));
    child.on("error", fail);
    child.on("close", (code) => {
      const text = Buffer.concat(chunks).toString();
      if (code === 0) done(text);
      else fail(Object.assign(new Error(`${cmd} ${args.join(" ")} exited ${code}`), { output: text }));
    });
  });
}

function touch(file: string): void {
  const now = new Date();
  utimesSync(file, now, now);
}

function prune(dir: string): void {
  if (!existsSync(dir)) return;
  const entries = readdirSync(dir)
    .filter((f) => f.endsWith(".tar"))
    .map((f) => {
      const { size, mtimeMs } = statSync(join(dir, f));
      return { file: join(dir, f), size, mtimeMs };
    })
    .toSorted((a, b) => b.mtimeMs - a.mtimeMs);
  const oldest = Date.now() - MAX_AGE_DAYS * 86_400_000;
  let total = 0;
  for (const e of entries) {
    total += e.size;
    if (e.mtimeMs < oldest || total > MAX_BYTES) rmSync(e.file, { force: true });
  }
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (f.startsWith(".tmp-") && statSync(p).mtimeMs < oldest) rmSync(p, { force: true });
  }
}

async function build(requested: string[]): Promise<void> {
  const all = loadWorkspace();
  const wanted = requested.length > 0 ? requested : [...all.keys()].filter((n) => n !== WEB);
  for (const n of wanted) if (!all.has(n)) throw new Error(`no workspace package ${n}`);
  const names = closure(wanted, (n) => all.get(n)!.deps);
  names.delete(WEB);
  const unitMap = units(all, names);
  const keys = computeKeys(all, unitMap);
  const dir = cacheDir();
  mkdirSync(dir, { recursive: true });

  const done = new Set<string>();
  const running = new Map<string, Promise<void>>();
  const jobs = Number(process.env.DIST_CACHE_JOBS ?? Math.min(4, availableParallelism()));
  let hits = 0;
  let misses = 0;
  const started = Date.now();

  const doUnit = async (unit: Unit): Promise<void> => {
    const tar = join(dir, `${keys.get(unit.id)}.tar`);
    const label = unit.members.map((m) => m.name.replace(/^@enumeratio\//, "")).join("+");
    const t0 = Date.now();
    if (existsSync(tar)) {
      for (const p of outputsOf(unit)) rmSync(join(root, p), { recursive: true, force: true });
      await run("tar", ["-xf", tar, "-C", root]);
      touch(tar);
      hits++;
      console.log(`  hit   ${label} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
      return;
    }
    const buildable = unit.members.filter((m) => m.buildScript !== undefined);
    if (buildable.length > 0) {
      const filters = buildable.flatMap((m) => ["--filter", m.name]);
      try {
        await run("pnpm", ["-r", ...filters, "run", "build"]);
      } catch (e) {
        console.error(
          `::group::${label} build failed\n${(e as { output?: string }).output ?? String(e)}\n::endgroup::`,
        );
        throw e;
      }
    }
    const outputs = outputsOf(unit);
    const list = join(dir, `.tmp-${process.pid}-${keys.get(unit.id)}.list`);
    const tmp = join(dir, `.tmp-${process.pid}-${keys.get(unit.id)}.tar`);
    writeFileSync(list, outputs.join("\n") + "\n");
    await run("tar", ["-cf", tmp, "-C", root, "-T", list]);
    rmSync(list, { force: true });
    renameSync(tmp, tar);
    misses++;
    console.log(`  built ${label} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  };

  // Units whose inputs are all done, up to `jobs` at once.
  const pending = new Map(unitMap);
  while (pending.size > 0 || running.size > 0) {
    for (const [id, unit] of pending) {
      if (running.size >= jobs) break;
      if (![...unit.deps].every((d) => done.has(d))) continue;
      pending.delete(id);
      running.set(
        id,
        doUnit(unit).then(() => {
          running.delete(id);
          done.add(id);
        }),
      );
    }
    if (running.size === 0) throw new Error(`stuck: ${[...pending.keys()].join(", ")}`);
    await Promise.race(running.values());
  }
  prune(dir);
  console.log(`dist-cache: ${hits} restored, ${misses} built in ${((Date.now() - started) / 1000).toFixed(0)}s`);
  const out = process.env.GITHUB_OUTPUT;
  if (out !== undefined) appendFileSync(out, `built=${misses}\nrestored=${hits}\n`);
}

const [command, ...rest] = process.argv.slice(2);
if (command === "build") await build(rest);
else if (command === "keys") {
  const all = loadWorkspace();
  const wanted = rest.length > 0 ? rest : [...all.keys()].filter((n) => n !== WEB);
  const names = closure(wanted, (n) => all.get(n)!.deps);
  names.delete(WEB);
  const unitMap = units(all, names);
  for (const [id, key] of computeKeys(all, unitMap)) console.log(`${key} ${id}`);
} else {
  console.error("usage: dist-cache.ts build|keys [package…]");
  process.exit(2);
}
