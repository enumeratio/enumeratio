// Pin the Gaussian-integer kernels against a Wolfram kernel over a seeded random corpus,
// write the answers to tests/gaussian.golden.json, and report where ours disagree.
// `vp test` reads the committed golden file and needs no oracle; this script does.
//
// Requires wolframscript on PATH. Run from the package:
//   node scripts/collect-gaussian-golden.ts

import { writeFileSync } from "node:fs";
import { type GoldenCase, type Value, ours } from "../tests/gaussian-cases.ts";
import { runKernel } from "@enumeratio/oracle/bounded";

let seed = 0x5eed_1234;
const next = (): number => {
  seed = (Math.imul(seed, 1_103_515_245) + 12_345) >>> 0;
  return seed / 2 ** 32;
};
const int = (lo: number, hi: number): number => lo + Math.floor(next() * (hi - lo + 1));
const gaussian = (r: number): [number, number] => [int(-r, r), int(-r, r)];
const nonzero = (r: number): [number, number] => {
  for (;;) {
    const z = gaussian(r);
    if (z[0] !== 0 || z[1] !== 0) return z;
  }
};
const complexArg = (args: Value[]): boolean =>
  args.some((a) => Array.isArray(a) && typeof a[1] === "number" && a[1] !== 0);

const cases: Omit<GoldenCase, "wolfram">[] = [];
const push = (op: string, args: Value[], mustBeComplex = true): void => {
  if (!mustBeComplex || complexArg(args)) cases.push({ op, args });
};

for (let k = 0; k < 200; k++) push("Mod", [gaussian(40), nonzero(12)]);
for (let k = 0; k < 40; k++) push("Mod", [gaussian(40), [int(1, 12), 0]], false);
for (let k = 0; k < 120; k++) push("Quotient", [gaussian(40), nonzero(12)]);
for (let k = 0; k < 120; k++) push("GCD", [gaussian(30), gaussian(30)]);
for (let k = 0; k < 80; k++) push("LCM", [nonzero(20), nonzero(20)]);
for (let k = 0; k < 200; k++) push("ExtendedGCD", [nonzero(30), nonzero(30)]);
for (let k = 0; k < 200; k++) push("ModularInverse", [nonzero(20), nonzero(12)]);
for (let k = 0; k < 60; k++) push("ModularInverse", [nonzero(20), [int(2, 15), 0]]);
for (let k = 0; k < 150; k++) push("PowerMod", [nonzero(15), int(-6, 60), nonzero(10)]);
for (let k = 0; k < 40; k++) push("PowerMod", [nonzero(15), int(-6, 60), [int(2, 20), 0]]);
push("PowerMod", [[3, 2], "100000000000000000000", [7, 2]]);
push("PowerMod", [[1, 2], "-123456789012345678901", [11, 0]]);
for (let k = 0; k < 150; k++) push("PrimeQ", [nonzero(40)]);
for (let n = -20; n <= 100; n++) push("PrimeQG", [[n, 0]], false);
for (let k = 0; k < 80; k++) push("FactorInteger", [nonzero(40)]);
for (let n = -30; n <= 120; n++) if (n !== 0) push("FactorIntegerG", [[n, 0]], false);
for (let k = 0; k < 40; k++) push("Divisors", [nonzero(30)]);
for (let n = 1; n <= 60; n++) push("DivisorsG", [[n, 0]], false);

const wl = (v: Value): string => (typeof v === "string" ? v : Array.isArray(v) ? `(${v[0]}) + (${v[1]}) I` : String(v));
const call = ({ op, args }: Omit<GoldenCase, "wolfram">): string => {
  const a = args.map(wl).join(", ");
  switch (op) {
    case "PrimeQG":
      return `PrimeQ[${a}, GaussianIntegers -> True]`;
    case "FactorIntegerG":
      return `FactorInteger[${a}, GaussianIntegers -> True]`;
    case "DivisorsG":
      return `Divisors[${a}, GaussianIntegers -> True]`;
    default:
      return `${op}[${a}]`;
  }
};

// Complex → {"C", re, im}; a call left unevaluated → null; one JSON line per case.
const head = (op: string): string => op.replace(/G$/, "");
const code = `
enc[x_] := x /. Complex[a_, b_] :> {"C", a, b};
Scan[Function[pair, Module[{r = Quiet[ReleaseHold[pair[[1]]]]},
  Print[ExportString[If[Head[r] === Symbol[pair[[2]]], Null, enc[r]], "RawJSON", "Compact" -> True]]]],
  {${cases.map((c) => `{Hold[${call(c)}], "${head(c.op)}"}`).join(",\n")}}]`;
const output = await runKernel("wolframscript", ["-code", code], { timeoutMs: 600_000 });
const lines = output
  .trim()
  .split("\n")
  .filter((line) => line !== "Null");
if (lines.length !== cases.length) throw new Error(`${lines.length} answers for ${cases.length} cases`);

const golden: GoldenCase[] = cases.map((c, k) => ({ ...c, wolfram: JSON.parse(lines[k]!) }));
writeFileSync(new URL("../tests/gaussian.golden.json", import.meta.url), JSON.stringify(golden) + "\n");

const disagree = golden.filter((c) => JSON.stringify(ours(c)) !== JSON.stringify(c.wolfram));
console.log(`cases ${golden.length}  |  disagree ${disagree.length}`);
for (const c of disagree.slice(0, 40)) {
  console.log(`  ${call(c)}: ours=${JSON.stringify(ours(c))} wolfram=${JSON.stringify(c.wolfram)}`);
}
if (disagree.length) process.exitCode = 1;
