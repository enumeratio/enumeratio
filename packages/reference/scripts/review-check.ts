// Runs the `- expect:` claims in the review backlog through the engine.
//
//   node packages/reference/scripts/review-check.ts [--file <REVIEW.md>] [--item <id>] [--tick] [--suggest]
//
// An item carries one or more `- expect: <Epsil> => <Epsil>` bullets (the left side is
// evaluated, and so is the right; they pass when equal, numerics to a relative 1e-9) or
// `- expect: <Epsil> => unevaluated`. `--tick` ticks an item `[x]` when it also carries
// `- auto: true` and every expect passes; `--suggest` prints candidate bullets mined from
// the `check:` text of items that have none.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// The backlog parser lives with the review panel in web/. It is loaded by URL, with its shape
// restated here, so the build's declaration pass (which follows imports) leaves web/ alone.
interface BacklogItem {
  id: string;
  status: string;
  check?: string;
  bullets: { key: string; value: string }[];
  feedback: string;
}
interface Backlog {
  parseBacklog: (raw: string) => { items: BacklogItem[] };
  applyItemPatch: (
    raw: string,
    id: string,
    patch: { status?: string; feedback?: string },
  ) => { raw: string } | undefined;
}
const { applyItemPatch, parseBacklog } = (await import(
  new URL("../../../web/.vitepress/review/backlog.ts", import.meta.url).href
)) as Backlog;
import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { parseExpression } from "@enumeratio/formats";
import { declaredEngine } from "./engines.ts";

export interface Expect {
  input: string;
  expected: string;
  tolerance: number;
}

export type Verdict = { ok: true } | { ok: false; got: string; want: string } | { ok: false; error: string };

/** `=>` compares numbers to 1e-9 relative; `~>` to 4e-16, about two ulps ("matches Wolfram to the last digit"). */
const TOLERANCE = { "=>": 1e-9, "~>": 4e-16 } as const;

export function parseExpects(item: BacklogItem): Expect[] {
  return item.bullets
    .filter((b) => b.key === "expect")
    .map((b) => {
      const m = /^(.*) (=>|~>) (.*)$/.exec(b.value);
      if (!m) throw new Error(`${item.id}: expect needs " => " or " ~> ": ${b.value}`);
      return { input: m[1]!.trim(), expected: m[3]!.trim(), tolerance: TOLERANCE[m[2] as keyof typeof TOLERANCE] };
    });
}

/** The elements of a list expression, else undefined. */
const elements = (e: BoxedExpression): readonly BoxedExpression[] | undefined =>
  e.operator === "List" ? (e as unknown as { ops: readonly BoxedExpression[] }).ops : undefined;

/** Numbers (complex too) agree to `tol` of their size, via |a - b|; lists agree elementwise. */
function approx(ce: ComputeEngine, a: BoxedExpression, b: BoxedExpression, tol: number): boolean {
  const [as, bs] = [elements(a), elements(b)];
  if (as && bs) return as.length === bs.length && as.every((x, i) => approx(ce, x, bs[i]!, tol));
  const gap = ce.box(["Abs", ["Subtract", a.json, b.json]] as never).N().re;
  const size = ce.box(["Abs", a.json] as never).N().re;
  return Number.isFinite(gap) && Number.isFinite(size) && gap <= tol * Math.max(size, Number.MIN_VALUE);
}

interface Evaluated {
  raw: BoxedExpression;
  expr: BoxedExpression;
}

function run(ce: ComputeEngine, src: string): Evaluated {
  const parsed = parseExpression(src, { ce });
  if (parsed.errors.length) throw new Error(parsed.errors.join("; "));
  const raw = ce.box(parsed.json as never);
  return { raw, expr: raw.evaluate() };
}

const show = (e: BoxedExpression): string => JSON.stringify(e.json);

export function check(ce: ComputeEngine, { input, expected, tolerance }: Expect): Verdict {
  try {
    const got = run(ce, input);
    if (expected === "unevaluated") {
      const same = show(got.expr) === show(got.raw);
      return same ? { ok: true } : { ok: false, got: show(got.expr), want: "unevaluated" };
    }
    if (show(got.expr).includes('"Error"')) return { ok: false, got: show(got.expr), want: "no error" };
    const want = run(ce, expected);
    if (show(got.expr) === show(want.expr)) return { ok: true };
    if (approx(ce, got.expr, want.expr, tolerance)) return { ok: true };
    return { ok: false, got: show(got.expr), want: show(want.expr) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Candidate `Head(args) = ascii-rhs` claims in prose; a human confirms each. */
export function suggest(item: BacklogItem): string[] {
  const text = item.check ?? "";
  const out: string[] = [];
  const re =
    /([A-Z][A-Za-z0-9]*\([^()=]*(?:\([^()]*\)[^()=]*)*\))\s*=\s*([-\w.{}[\], ()/^+*]+?)(?=[;,.]\s|[;,.]$|\s+\(|\s+and\s|$)/g;
  for (const m of text.matchAll(re)) {
    if (/[^\x20-\x7e]/.test(m[0])) continue;
    out.push(`- expect: ${m[1]} => ${m[2]!.trim()}`);
  }
  return out;
}

function reviewFile(arg?: string): string {
  if (arg) return resolve(arg);
  if (process.env.REVIEW_FILE) return resolve(process.env.REVIEW_FILE);
  const common = execFileSync("git", ["rev-parse", "--git-common-dir"], { encoding: "utf8" }).trim();
  return resolve(common, "lanes", "REVIEW.md");
}

function main(argv: string[]): number {
  const flag = (name: string) => argv.includes(name);
  const value = (name: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
  const file = reviewFile(value("--file"));
  let raw = readFileSync(file, "utf8");
  const only = value("--item");
  const items = parseBacklog(raw).items.filter((i) => !only || i.id === only);

  if (flag("--suggest")) {
    for (const item of items) {
      if (item.bullets.some((b) => b.key === "expect")) continue;
      const found = suggest(item);
      if (found.length) console.log(`### ${item.id}\n${found.join("\n")}\n`);
    }
    return 0;
  }

  const ce = declaredEngine();
  let failed = 0;
  let total = 0;
  for (const item of items) {
    const expects = parseExpects(item);
    if (!expects.length) continue;
    const verdicts = expects.map((e) => check(ce, e));
    total += verdicts.length;
    const bad = verdicts.filter((v) => !v.ok).length;
    failed += bad;
    const mark = bad ? "FAIL" : "pass";
    console.log(`${mark}  ${item.id} (${verdicts.length - bad}/${verdicts.length})`);
    verdicts.forEach((v, i) => {
      if (v.ok) return;
      const e = expects[i]!;
      console.log(`      ${e.input}`);
      console.log(`        ${"error" in v ? `error: ${v.error}` : `got ${v.got}, want ${v.want}`}`);
    });
    const auto = item.bullets.some((b) => b.key === "auto" && b.value === "true");
    if (flag("--tick") && auto && !bad && item.status === "open") {
      const note = `auto-checked ${new Date().toISOString().slice(0, 10)}: ${verdicts.length} expect(s) pass`;
      const patched = applyItemPatch(raw, item.id, {
        status: "reviewed",
        feedback: item.feedback ? `${item.feedback}\n\n${note}` : note,
      });
      if (patched) raw = patched.raw;
    }
  }
  if (flag("--tick")) writeFileSync(file, raw);
  console.log(`\n${total - failed}/${total} expects pass`);
  return failed ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main(process.argv.slice(2)));
