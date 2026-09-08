// Generator: turns the NODES dataset into docs/reference/<slug>.md, computing every example number from the
// live pack kernels (allEntries) so a page can never assert a stale count/element. The committed .md files are
// OUTPUTS — this script + nodes.ts are the source of truth.
//
//   node --import tsx docs/.vitepress/reference/generate.mts            # write/refresh every page
//   node --import tsx docs/.vitepress/reference/generate.mts --check    # exit 1 if any committed page is stale
//   node --import tsx docs/.vitepress/reference/generate.mts --dry-run  # print what would change, write nothing
//
// --check is the CI lint AND the "does my branch need regenerating?" probe: same script, three modes, idempotent.
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { allEntries, adaptEntry, type NestedTree } from "../../../packages/compute-engine/src/packs/index.ts";
import { sharedCore } from "@enumeratio/data/node";
import { COLL_HEADS } from "../../../packages/client/src/ce-enum-engine.ts";
import { pascalCase } from "../../../packages/notatio/src/latex.ts";
import { NODES } from "./nodes.ts";
import { renderPage, type NodeDoc, type ResolvedNode, type XRef } from "./render.ts";

// External-reference systems: display label + preferred order (unknown systems sort last, alphabetically).
// The set is read LIVE from base_reference, so a new system (mathworld, fungrim, dlmf, …) appears automatically.
const SYSTEM_LABEL: Record<string, string> = {
  wikipedia: "Wikipedia", oeis: "OEIS", wolfram: "Wolfram Language", mathworld: "MathWorld",
  fungrim: "Fungrim", dlmf: "DLMF", sage: "SageMath", mathlib4: "Mathlib4", sympy: "SymPy", matlab: "MATLAB",
};
const SYSTEM_ORDER = ["wikipedia", "oeis", "wolfram", "mathworld", "fungrim", "dlmf", "sage", "mathlib4", "sympy", "matlab"];
const systemRank = (s: string): number => { const i = SYSTEM_ORDER.indexOf(s); return i === -1 ? SYSTEM_ORDER.length : i; };

const here = dirname(fileURLToPath(import.meta.url));
const refDir = join(here, "../../reference"); // docs/reference
const entryByHead = new Map(allEntries.map((e) => [e.head, e]));
// The canonical route/filename IS the PascalCase head (a node may override via `slug`); the SQL snake id is
// never used in a route — PascalCase is canonical (see AGENTS/notes on the identifier direction).
const slugOf = (n: NodeDoc): string => n.slug ?? n.head;
const slugByHead = new Map(NODES.map((n) => [n.head, slugOf(n)]));

// ── element formatting: ints [1, 2, 3]; blocks [[1, 2], [3]]; nested trees recurse; leaf = number ──
function fmt(el: number[] | number[][] | NestedTree): string {
  if (typeof el === "number") return String(el);
  if (Array.isArray(el)) return `[${(el as any[]).map(fmt).join(", ")}]`;
  return String(el);
}

// ── {placeholder} resolver, bound to one collection's kernel. Grammar (`;` splits primary arg from a
//    params override): {count} {count(4,2)} {first(6)} {first(6; 4,2)} {at(0)} {at(0; 4,2)}
//    {rank([2,3])} {rank0([2,3])} {rank([2,3]; 4,2)} — rank is 1-based, rank0 the raw 0-based kernel value. ──
function makeResolver(head: string, defaultParams: number[]) {
  const e = entryByHead.get(head);
  if (!e) throw new Error(`resolver: "${head}" is not a pack collection (has no kernel to compute against)`);
  const splitArgs = (raw: string): { primary: string; params: number[] } => {
    const [primary, pstr] = raw.split(";").map((s) => s.trim());
    const params = pstr ? pstr.split(",").map((s) => Number(s.trim())) : defaultParams;
    return { primary, params };
  };
  return (str: string): string =>
    str.replace(/\{(count|card|first|at|rank0|rank)(?:\(([^)]*)\))?\}/g, (_m, fn, argRaw) => {
      const { primary, params } = splitArgs(argRaw ?? "");
      switch (fn) {
        case "count":
        case "card":
          return String(e.count(argRaw ? primary.split(",").map(Number) : defaultParams));
        case "first": {
          const m = Number(primary);
          return Array.from({ length: m }, (_v, r) => fmt(e.unrank(params, r))).join(", ");
        }
        case "at":
          return fmt(e.unrank(params, Number(primary)));
        case "rank0":
          return String(e.rank(JSON.parse(primary), params));
        case "rank":
          return String(e.rank(JSON.parse(primary), params) + 1);
        default:
          throw new Error(`unknown placeholder {${fn}}`);
      }
    });
}

// non-collection nodes get an identity resolver (no kernel; authored text passes through verbatim).
const identity = (s: string) => s;

// head → slug for a head NOT in the dataset (legacy hand-authored pages): generic kebab, which round-trips
// every existing slug (BellB→bell-b, PartitionsP→partitions-p, random_element→random-element, …).
const kebab = (head: string): string =>
  head
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();

/** A live-notebook seed synthesized from the catalog for a collection the pure-CE notebook can ENUMERATE — i.e.
 *  one with a compute-engine library twin (`COLL_HEADS`, the single source of that fact). Uses the collection's
 *  PascalCase entity name (what the notebook resolves — `permutations` → `Permutations`, the primary entity; a
 *  distinct `SymmetricGroup` alt-sort would be its own node) applied to the page's example params:
 *  `[ Name(params), |Name(params)|, Name(params)[1] ]` — the entity, its cardinality, and its first element.
 *  Only when the node didn't hand-author its own seed. Not enumerable / not a collection → no live notebook. */
function defaultNotebookSeed(n: NodeDoc): string[] | undefined {
  if (n.kind !== "collection" || !n.catalogId || !n.examples) return undefined;
  if (!(n.catalogId in COLL_HEADS)) return undefined;
  const call = `${pascalCase(n.catalogId)}(${n.examples.params.join(", ")})`;
  return [call, `\\left|${call}\\right|`, `${call}[1]`];
}

function resolveNode(n: NodeDoc, xrefsBySubject: Map<string, XRef[]>): ResolvedNode {
  const resolve =
    n.kind === "collection" && n.examples ? makeResolver(n.head, n.examples.params) : identity;
  const R = (s: string) => resolve(s);
  const xrefs = (n.catalogId ? xrefsBySubject.get(n.catalogId) : undefined) ?? [];
  const xrefsResolved = [...xrefs]
    .sort((a, b) => systemRank(a.system) - systemRank(b.system) || a.system.localeCompare(b.system))
    .map((x) => ({ label: SYSTEM_LABEL[x.system] ?? x.system, identity: x.identity, url: x.url, delta: x.delta, relation: x.relation }));
  const seeAlsoResolved = n.seeAlso.map((s) => {
    const slug = slugByHead.get(s.head) ?? kebab(s.head);
    // link when the target is a dataset head (its page will be generated) OR a page already exists on disk
    // (a legacy hand-authored page); otherwise a bare code span — never a dead link, never a guess.
    const inDataset = slugByHead.has(s.head);
    const link = inDataset || existsSync(join(refDir, `${slug}.md`)) ? `/reference/${slug}` : undefined;
    return { text: s.head, link, note: s.note };
  });
  return {
    ...n,
    tagline: R(n.tagline),
    usage: n.usage.map((u) => ({ form: R(u.form), meaning: R(u.meaning) })),
    details: n.details.map((d) => ({ label: d.label, body: R(d.body) })),
    // notebook seeds pass through VERBATIM — they're live-eval inputs, and the {…} placeholder delimiter
    // would collide with LaTeX braces (\operatorname{rank} etc.). The notebook computes their values live.
    examples: n.examples
      ? { ...n.examples, narrative: n.examples.narrative.map(R), notebook: n.examples.notebook ?? defaultNotebookSeed(n) }
      : undefined,
    examplesRaw: n.examplesRaw?.map(R),
    seeAlsoResolved,
    xrefsResolved,
  };
}

// Pull every collection cross-reference from the catalog's base_reference (single source of truth), grouped by
// subject id. Booting the core is a few seconds; generation isn't hot, and this keeps xrefs from drifting.
async function loadXrefs(): Promise<Map<string, XRef[]>> {
  const pg = await sharedCore();
  const res = await pg.query(
    `SELECT subject, system, identity, url, delta, relation FROM base_reference
      WHERE subject_kind = 'collection' ORDER BY subject, system`,
  );
  const bySubject = new Map<string, XRef[]>();
  for (const r of res.rows as any[]) {
    const list = bySubject.get(r.subject) ?? [];
    list.push({ system: r.system, identity: r.identity, url: r.url, delta: r.delta, relation: r.relation });
    bySubject.set(r.subject, list);
  }
  return bySubject;
}

const GEN_HEADER = "<!-- GENERATED by docs/.vitepress/reference/generate.mts from nodes.ts — do not edit by hand. -->\n";

// ── the catalog block injected into index.md between markers: families → head + one-line summary (tagline),
//    every migrated head linked. Grows automatically as families are migrated into the dataset. ──
const CATALOG_START = "<!-- CATALOG:START (generated from nodes.ts — do not edit between markers) -->";
const CATALOG_END = "<!-- CATALOG:END -->";

function catalogBlock(): string {
  const byFamily = new Map<string, NodeDoc[]>();
  for (const n of NODES) {
    if (!byFamily.has(n.family)) byFamily.set(n.family, []);
    byFamily.get(n.family)!.push(n);
  }
  const lines: string[] = [CATALOG_START, ""];
  for (const [family, nodes] of byFamily) {
    lines.push(`### ${family}`, "");
    for (const n of nodes) lines.push(`- [**${n.head}**](/reference/${slugOf(n)}) — ${n.tagline}`);
    lines.push("");
  }
  lines.push(CATALOG_END);
  return lines.join("\n");
}

function injectCatalog(mode: "write" | "check" | "dry"): { changed: boolean } {
  const file = join(refDir, "index.md");
  const src = readFileSync(file, "utf8");
  const s = src.indexOf(CATALOG_START);
  const e = src.indexOf(CATALOG_END);
  if (s === -1 || e === -1) throw new Error("index.md is missing the CATALOG markers");
  const next = src.slice(0, s) + catalogBlock() + src.slice(e + CATALOG_END.length);
  const changed = next !== src;
  if (changed && mode === "write") writeFileSync(file, next);
  return { changed };
}

async function main() {
  const mode = process.argv.includes("--check") ? "check" : process.argv.includes("--dry-run") ? "dry" : "write";
  const stale: string[] = [];
  const written: string[] = [];
  const managed = new Set<string>();
  const xrefsBySubject = await loadXrefs();

  for (const n of NODES) {
    const md = GEN_HEADER + renderPage(resolveNode(n, xrefsBySubject));
    const file = join(refDir, `${slugOf(n)}.md`);
    managed.add(`${slugOf(n)}.md`);
    const current = existsSync(file) ? readFileSync(file, "utf8") : null;
    if (current === md) continue;
    stale.push(slugOf(n));
    if (mode === "write") writeFileSync(file, md), written.push(slugOf(n));
  }

  // a managed slug that lost its dataset entry leaves an orphan .md — flag it (don't auto-delete)
  const orphans = readdirSync(refDir)
    .filter((f) => f.endsWith(".md") && f !== "index.md")
    .filter((f) => !managed.has(f) && readFileSync(join(refDir, f), "utf8").startsWith("<!-- GENERATED"));

  const catalog = injectCatalog(mode);
  if (catalog.changed) stale.push("index.md (catalog block)");

  if (mode === "check") {
    if (stale.length || orphans.length) {
      if (stale.length) console.error(`stale (regenerate): ${stale.join(", ")}`);
      if (orphans.length) console.error(`orphaned generated pages (remove from dataset or delete): ${orphans.join(", ")}`);
      process.exit(1);
    }
    console.log(`ok — ${NODES.length} pages + index catalog in sync`);
    return;
  }
  console.log(
    mode === "dry"
      ? `would write ${stale.length}: ${stale.join(", ") || "(none)"}`
      : `wrote ${written.length}${catalog.changed ? " + index catalog" : ""}: ${written.join(", ") || "(none)"}`,
  );
  if (orphans.length) console.warn(`orphaned generated pages: ${orphans.join(", ")}`);
}

await main();
process.exit(0);
