// Inserts `- expect:` bullets (and optionally `- auto: true`) into backlog items, after the
// item's `check:` bullet.
//
//   node packages/reference/scripts/review-add.ts <expects.tsv> [--auto id,id] [--file <REVIEW.md>]
//
// The TSV has `<item id>\t<input> => <expected>` rows. Items that already carry the exact bullet are skipped.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const argv = process.argv.slice(2);
const tsv = argv[0];
if (!tsv) throw new Error("usage: add.ts <expects.tsv> [--auto id,id] [--file REVIEW.md]");
const flag = (n: string) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : undefined);
const file =
  flag("--file") ??
  resolve(execFileSync("git", ["rev-parse", "--git-common-dir"], { encoding: "utf8" }).trim(), "lanes", "REVIEW.md");
const auto = new Set((flag("--auto") ?? "").split(",").filter(Boolean));

const rows = new Map<string, string[]>();
for (const line of readFileSync(tsv, "utf8").split("\n")) {
  const [id, expect] = line.split("\t");
  if (id && expect) rows.set(id, [...(rows.get(id) ?? []), expect]);
}

const lines = readFileSync(file, "utf8").split("\n");
const out: string[] = [];
let current: string | undefined;
const missing = new Set(rows.keys());
for (let i = 0; i < lines.length; i++) {
  const line = lines[i]!;
  out.push(line);
  const heading = /^### \[[ xX!]\] .+ \{#([\w-]+)\}\s*$/.exec(line);
  if (heading) current = heading[1];
  if (current && rows.has(current) && line.startsWith("- check:")) {
    missing.delete(current);
    const block = lines.slice(
      i,
      lines.findIndex((l, j) => j > i && l.startsWith("#### Feedback")),
    );
    for (const e of rows.get(current)!) if (!block.includes(`- expect: ${e}`)) out.push(`- expect: ${e}`);
    if (auto.has(current) && !block.includes("- auto: true")) out.push("- auto: true");
  }
}
if (missing.size) console.error(`no check: bullet found for: ${[...missing].join(", ")}`);
writeFileSync(file, out.join("\n"));
