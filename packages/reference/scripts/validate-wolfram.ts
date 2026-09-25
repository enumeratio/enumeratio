// Cross-validate the reference library against a Wolfram kernel: transpile each
// documented example's expression to Wolfram Language, evaluate it in one
// `wolframscript` call, and compare the numeric/boolean result to compute-engine's
// grounded `expected`. Disagreements are the signal -- either a transpiler gap or
// a genuine compute-engine-vs-Wolfram convention difference (rounding mode, log
// base, argument order, …).
//
// Requires Wolfram Engine + wolframscript on PATH. Not part of `vp test` (needs an
// external kernel); run manually:
//   node packages/reference/scripts/validate-wolfram.ts
//
// Extension heads with no Wolfram equivalent (our collections/statistics) stay
// symbolic in Wolfram and are reported separately as "wl-unsupported", not failures.

import { runKernel } from "@enumeratio/oracle/bounded";
import { toWolfram } from "@enumeratio/wolfram/src";
import { referenceEntries } from "../src/node.ts";

const entries = referenceEntries();

type Expected = unknown;

const asNumber = (v: Expected): number | null =>
  typeof v === "number"
    ? v
    : v && typeof v === "object" && "num" in v
      ? Number((v as { num: string }).num)
      : null;

interface Case {
  label: string;
  wl: string;
  expected: Expected;
  isBool: boolean;
  n: number | null;
}

const cases: Case[] = [];
for (const entry of entries) {
  for (const [i, ex] of entry.examples.entries()) {
    if (ex.aspirational) continue;
    const isBool = ex.expected === "True" || ex.expected === "False";
    const n = asNumber(ex.expected);
    if (!isBool && n === null) continue; // only numeric / boolean are comparable
    let wl: string;
    try {
      wl = toWolfram(ex.expr as never);
    } catch {
      continue;
    }
    cases.push({ label: `${entry.name}#${i + 1}`, wl, expected: ex.expected, isBool, n });
  }
}

// One kernel call: print "index|InputForm[N[expr]]" per case. Each source goes through
// `ToExpression` as a string so one syntax error yields `$Failed` for that case instead of
// aborting the whole batch (which silently zeroed everything after it, once).
const code = cases
  .map(
    (c, k) =>
      `Print["${k}|", ToString[N[Quiet[ToExpression[${JSON.stringify(c.wl)}]]], InputForm]]`,
  )
  .join(";\n");
const out = await runKernel("wolframscript", ["-code", code], { timeoutMs: 180_000 });

const got = new Map<number, string>();
for (const line of out.split("\n")) {
  const m = line.match(/^(\d+)\|(.*)$/);
  if (m) got.set(Number(m[1]), m[2].trim());
}

let agree = 0;
const disagree: string[] = [];
const unsupported: string[] = [];
cases.forEach((c, k) => {
  const wlVal = got.get(k) ?? "";
  if (c.isBool) {
    if (wlVal === c.expected) agree++;
    else if (/[A-Za-z]\[/.test(wlVal)) unsupported.push(`${c.label}: WL=${wlVal}`);
    else disagree.push(`${c.label}: WL=${wlVal} exp=${String(c.expected)} | ${c.wl}`);
    return;
  }
  const w = Number(wlVal);
  if (!Number.isFinite(w)) {
    unsupported.push(`${c.label}: WL=${wlVal}`);
    return;
  }
  const tol = Math.max(1e-4, Math.abs(c.n ?? 0) * 1e-4);
  if (Math.abs(w - (c.n ?? 0)) <= tol) agree++;
  else disagree.push(`${c.label}: WL=${wlVal} exp=${c.n} | ${c.wl}`);
});

console.log(
  `\nCOMPARED ${cases.length}  |  agree ${agree}  disagree ${disagree.length}  wl-unsupported ${unsupported.length}`,
);
console.log("\n--- DISAGREEMENTS (transpiler gap or genuine CE-vs-Wolfram divergence) ---");
for (const d of disagree) console.log("  " + d);
console.log(
  `\n--- WL-UNSUPPORTED: ${unsupported.length} (our extension heads / WL stays symbolic) ---`,
);
