// Fail when a rescan changed what the committed implementations records SAY: a row's
// verdict, classification, input or presence. A row's printed output is only reported,
// since a float's last digits can differ between the machine that committed it and the
// runner, and the verdict already says whether the value agrees.
//
//   node .github/scripts/oracle-drift.ts        # after oracle-scan.ts, in a checkout

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { parseYaml } from "../../packages/entry/src/yaml.ts";

type Row = Record<string, unknown>;
type Record_ = Record<string, Record<string, Row>>;

const git = (...args: string[]): string => execFileSync("git", args, { encoding: "utf8" });
const RECORD = /^packages\/.*\/(reference|entries)\/[^/]+\.implementations\.yaml$/;
// Committed records, and any the scan just created.
const files = [
  ...new Set([...git("ls-files").split("\n"), ...git("ls-files", "--others", "--exclude-standard").split("\n")]),
].filter((f) => RECORD.test(f));

const read = (text: string | undefined): Record_ => (text ? ((parseYaml(text) ?? {}) as Record_) : {});
const committed = (file: string): string | undefined => {
  try {
    return git("show", `HEAD:${file}`);
  } catch {
    return undefined;
  }
};

const rows = (head: string, record: Record_): Map<string, Row> => {
  const out = new Map<string, Row>();
  for (const [id, bySystem] of Object.entries(record))
    for (const [system, row] of Object.entries(bySystem)) out.set(`${head}/${id} (${system})`, row);
  return out;
};

const said = (row: Row | undefined): string => {
  if (row === undefined) return "(no row)";
  const { out: _out, shown: _shown, ...rest } = row;
  return JSON.stringify(rest, Object.keys(rest).sort());
};

const changed: string[] = [];
const printed: string[] = [];
for (const file of files) {
  const head = basename(file, ".implementations.yaml");
  const before = rows(head, read(committed(file)));
  const after = rows(head, read(existsSync(file) ? readFileSync(file, "utf8") : undefined));
  for (const id of new Set([...before.keys(), ...after.keys()])) {
    const [b, a] = [before.get(id), after.get(id)];
    if (said(b) !== said(a)) changed.push(`${id}\n  was: ${said(b)}\n  now: ${said(a)}`);
    else if (b?.["out"] !== a?.["out"]) printed.push(`${id}: ${String(b?.["out"])} → ${String(a?.["out"])}`);
  }
}

if (printed.length > 0) console.log(`output text only (not a failure):\n${printed.join("\n")}\n`);
if (changed.length > 0) {
  console.log(`${changed.length} row(s) changed:\n${changed.join("\n")}`);
  process.exit(1);
}
console.log("no drift");
