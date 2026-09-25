// Fail when a rescan changed what the committed oracle sidecars SAY: a row's verdict,
// classification, input or presence. A row's printed output is only reported, since a
// float's last digits can differ between the machine that committed it and the runner, and
// the verdict already says whether the value agrees. `kernels` (version stamps) is ignored.
//
//   node .github/scripts/oracle-drift.ts        # after oracle-scan.ts, in a checkout

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";

type Row = Record<string, unknown>;
type Sidecar = { examples?: Record<string, Record<string, Record<string, Row>>> };

const dir = "packages/reference/src/entries";
const committed = (file: string): Sidecar => {
  try {
    return JSON.parse(execFileSync("git", ["show", `HEAD:${dir}/${file}`], { encoding: "utf8" }));
  } catch {
    return {};
  }
};

const rows = (sidecar: Sidecar): Map<string, Row> => {
  const out = new Map<string, Row>();
  for (const [head, byKey] of Object.entries(sidecar.examples ?? {}))
    for (const [key, bySystem] of Object.entries(byKey))
      for (const [system, row] of Object.entries(bySystem))
        out.set(`${head} ${key} (${system})`, row);
  return out;
};

const said = (row: Row | undefined): string => {
  if (row === undefined) return "(no row)";
  const { output: _output, ...rest } = row;
  return JSON.stringify(rest, Object.keys(rest).sort());
};

const changed: string[] = [];
const printed: string[] = [];
for (const file of readdirSync(dir).filter((f) => f.endsWith(".oracle.json"))) {
  const before = rows(committed(file));
  const after = rows(JSON.parse(readFileSync(`${dir}/${file}`, "utf8")) as Sidecar);
  for (const id of new Set([...before.keys(), ...after.keys()])) {
    const [b, a] = [before.get(id), after.get(id)];
    if (said(b) !== said(a)) changed.push(`${file} ${id}\n  was: ${said(b)}\n  now: ${said(a)}`);
    else if (b?.["output"] !== a?.["output"])
      printed.push(`${file} ${id}: ${String(b?.["output"])} → ${String(a?.["output"])}`);
  }
}

if (printed.length > 0) console.log(`output text only (not a failure):\n${printed.join("\n")}\n`);
if (changed.length > 0) {
  console.log(`${changed.length} row(s) changed:\n${changed.join("\n")}`);
  process.exit(1);
}
console.log("no drift");
