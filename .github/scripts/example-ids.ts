// An example's id is its address: `#example/<id>` on its page, its test name, its rows in the
// implementations record (https://github.com/enumeratio/enumeratio/wiki/Examples-as-Data §3).
// Deleting an example is fine. Giving a surviving example a new id breaks every link to it,
// so a rename has to be said out loud:
// the PR description carries a line `renamed: <Head>/<old> -> <new>` for each one.
//
//   BASE=<merge-base sha> PR_BODY="$(…)" node .github/scripts/example-ids.ts

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import { decodeCell, parseTsv } from "../../packages/entry/src/tsv.ts";
import { parseYaml } from "../../packages/entry/src/yaml.ts";

const RECORD = /^packages\/(.*\/reference|reference\/entries)\/[^/]+\.yaml$/;
// A head folder's examples, `<dir>/<Head>/examples.tsv`.
const TABLE = /^packages\/(.*\/reference|reference\/entries)\/[^/]+\/examples\.tsv$/;
const git = (...args: string[]): string => execFileSync("git", args, { encoding: "utf8", maxBuffer: 1 << 28 });
const base = process.env.BASE ?? git("merge-base", "HEAD", "origin/main").trim();

type Ids = Map<string, Map<string, string>>; // head -> id -> JSON of expr
type Example = { id: string; expr: unknown };
const collect = (files: string[], read: (file: string) => string): Ids => {
  const out: Ids = new Map();
  for (const file of files) {
    if (file.includes("/tests/")) continue;
    if (TABLE.test(file)) {
      const head = basename(dirname(file));
      const ids = out.get(head) ?? new Map<string, string>();
      for (const row of parseTsv(read(file)).rows)
        ids.set(row["id"]!, JSON.stringify(decodeCell(row["expr"] ?? "", "flow")));
      out.set(head, ids);
      continue;
    }
    if (!RECORD.test(file) || file.endsWith(".implementations.yaml")) continue;
    // Before head folders, examples sat in `<Head>.examples.yaml`, and before that in `<Head>.yaml`.
    const data = parseYaml(read(file)) as Example[] | { examples?: Example[] };
    const head = basename(file, ".yaml").replace(/\.examples$/, "");
    const ids = out.get(head) ?? new Map<string, string>();
    for (const example of (Array.isArray(data) ? data : data.examples) ?? [])
      ids.set(example.id, JSON.stringify(example.expr));
    out.set(head, ids);
  }
  return out;
};

const before = collect(git("ls-tree", "-r", "--name-only", base).split("\n"), (f) => git("show", `${base}:${f}`));
const after = collect(git("ls-files").split("\n"), (f) => readFileSync(f, "utf8"));

const declared = new Set(
  [...(process.env.PR_BODY ?? "").matchAll(/^\s*renamed:\s*(\S+)\/(\S+)\s*->\s*(\S+)\s*$/gm)].map(
    ([, head, from, to]) => `${head}/${from} -> ${to}`,
  ),
);

const renames: string[] = [];
let deleted = 0;
for (const [head, ids] of before) {
  const now = after.get(head) ?? new Map<string, string>();
  const added = [...now].filter(([id]) => !ids.has(id));
  for (const [id, expr] of ids) {
    if (now.has(id)) continue;
    const to = added.find(([, e]) => e === expr)?.[0];
    if (to === undefined) deleted++;
    else renames.push(`${head}/${id} -> ${to}`);
  }
}

const undeclared = renames.filter((r) => !declared.has(r));
console.log(`${renames.length} renamed, ${deleted} deleted since ${base.slice(0, 8)}`);
if (undeclared.length > 0) {
  console.log(
    `\nThese examples kept their expr but changed id, which breaks links to them. Keep the old ids, or add each line to the PR description:\n${undeclared.map((r) => `renamed: ${r}`).join("\n")}`,
  );
  process.exit(1);
}
