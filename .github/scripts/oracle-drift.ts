// Fail when a rescan changed what the committed implementations records SAY: a row's
// verdict, classification, input or presence. A row's printed output is only reported,
// since a float's last digits can differ between the machine that committed it and the
// runner, and the verdict already says whether the value agrees.
//
// A row this system has never answered (the forms collect-forms writes for a new example:
// an input, no verdict or output) that the scan now answers is new, not drift: a feature PR
// adds examples without running the weekly kernels, by design. Those are listed as a
// warning, to classify at the next accept, and don't fail the lane.
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

/** Written by collect-forms, never answered by this system. */
const unscanned = (row: Row | undefined): boolean =>
  row !== undefined && row["verdict"] === undefined && row["out"] === undefined && row["kind"] === undefined;

const changed: string[] = [];
const fresh: string[] = [];
const printed: string[] = [];
for (const file of files) {
  const head = basename(file, ".implementations.yaml");
  const before = rows(head, read(committed(file)));
  const after = rows(head, read(existsSync(file) ? readFileSync(file, "utf8") : undefined));
  for (const id of new Set([...before.keys(), ...after.keys()])) {
    const [b, a] = [before.get(id), after.get(id)];
    if (said(b) === said(a)) {
      if (b?.["out"] !== a?.["out"]) printed.push(`${id}: ${String(b?.["out"])} → ${String(a?.["out"])}`);
    } else if (unscanned(b) && b?.["in"] === a?.["in"]) fresh.push(`${id}: ${said(a)}`);
    else changed.push(`${id}\n  was: ${said(b)}\n  now: ${said(a)}`);
  }
}

if (printed.length > 0) console.log(`output text only (not a failure):\n${printed.join("\n")}\n`);
if (fresh.length > 0) {
  console.log(
    `::warning::${fresh.length} new row(s) to classify at the next accept (the run's oracle-records artifact has them)`,
  );
  console.log(`${fresh.length} new row(s), answered for the first time (not a failure):\n${fresh.join("\n")}\n`);
}
if (changed.length > 0) {
  console.log(`${changed.length} row(s) changed:\n${changed.join("\n")}`);
  process.exit(1);
}
console.log("no drift");
