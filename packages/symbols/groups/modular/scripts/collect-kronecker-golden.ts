// Pin KroneckerSymbol against a Wolfram kernel over the full grid a, n ∈ [-10, 10] (the
// range Wolfram's own KroneckerSymbol docs exercise), write the values to
// tests/kronecker.golden.json, and report any disagreement with our implementation.
// `vp test` reads the committed golden file and needs no oracle; this script does.
//
// Requires wolframscript on PATH. Run from the package:
//   node scripts/collect-kronecker-golden.ts

import { writeFileSync } from "node:fs";
import { kroneckerSymbol } from "../src/kronecker.ts";
import { runKernel } from "@enumeratio/oracle/bounded";

const RANGE = 10;

const code = `Do[Print[a," ",n," ",KroneckerSymbol[a,n]],{a,-${RANGE},${RANGE}},{n,-${RANGE},${RANGE}}]`;
const output = await runKernel("wolframscript", ["-code", code]);

interface GoldenCase {
  a: number;
  n: number;
  value: number;
}

const goldens: GoldenCase[] = [];
const disagree: string[] = [];

for (const line of output.trim().split("\n")) {
  if (!/^-?\d+\s+-?\d+\s+-?\d+$/.test(line.trim())) continue; // skips the trailing `Null`
  const [aStr, nStr, valueStr] = line.trim().split(/\s+/);
  const a = Number(aStr);
  const n = Number(nStr);
  const value = Number(valueStr);
  goldens.push({ a, n, value });

  const ours = kroneckerSymbol(BigInt(a), BigInt(n));
  if (ours !== BigInt(value)) {
    disagree.push(`KroneckerSymbol(${a}, ${n}): ours=${ours} wolfram=${value}`);
  }
}

writeFileSync(
  new URL("../tests/kronecker.golden.json", import.meta.url),
  JSON.stringify(goldens, null, 2) + "\n",
);

console.log(
  `cases ${goldens.length}  |  agree ${goldens.length - disagree.length}  disagree ${disagree.length}`,
);
if (disagree.length) {
  console.log("\n--- DISAGREEMENTS ---");
  for (const d of disagree) console.log("  " + d);
  process.exitCode = 1;
}
