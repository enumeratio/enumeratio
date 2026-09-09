// DB → data emit. The catalog (pglite) is the source of truth; this boots it once at build time and emits the
// per-collection facts the reference registry needs into _generated/catalog.json — so nodes.ts stays a THIN
// overlay (docs-only prose + symbols the catalog doesn't hold yet) rather than a parallel truth.
//
//   node --import tsx docs/.vitepress/reference/emit-catalog.mts          # write _generated/catalog.json
//   node --import tsx docs/.vitepress/reference/emit-catalog.mts --check  # exit 1 if the committed emit is stale
//
// Emitted shape, keyed by catalog collection id (snake):
//   { title, carrier, unbounded, aliasOf, axes:[{pos,name,lo,hi,admissible}], params:[…],
//     stats:[{id,title,codomain}], maps:[{id,fn}], xrefs:[{system,identity,url,delta,relation}], oeis:[{a,name}] }
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { sharedCore } from "@enumeratio/data/node";

const here = dirname(fileURLToPath(import.meta.url));
const outFile = join(here, "_generated", "catalog.json");

export interface CatalogGrade { pos: number; name: string; lo: string | null; hi: string | null; admissible: string | null }
export interface CatalogStat { id: string; title: string | null; codomain: string | null }
export interface CatalogMap { id: string; fn: string | null }
export interface CatalogXRef { system: string; identity: string; url: string | null; delta: string; relation: string }
export interface CatalogOeis { a: string; name: string | null }
export interface CatalogCollection {
  title: string | null;
  carrier: string | null;
  unbounded: boolean;
  aliasOf: string | null;
  axes: CatalogGrade[];
  params: CatalogGrade[];
  stats: CatalogStat[];
  maps: CatalogMap[];
  xrefs: CatalogXRef[];
  oeis: CatalogOeis[];
  /** the @enumeratio/compute-engine twin (library head + arity), or null — the generator reads this instead of a
   *  client-side map (base_compute_engine_twin). */
  computeEngineTwin: { head: string; arity: number } | null;
}
export type CatalogEmit = Record<string, CatalogCollection>;

async function emit(): Promise<CatalogEmit> {
  const pg = await sharedCore();
  const rows = async (sql: string) => (await pg.query(sql)).rows as any[];

  const cat = await rows(`SELECT id, carrier, unbounded, title, alias_of FROM base_catalog ORDER BY id`);
  const grades = await rows(`SELECT collection, pos, name, lo_expr, hi_expr, role, admissible FROM base_grade ORDER BY collection, pos`);
  const stats = await rows(`SELECT collection, stat_id, title, codomain FROM base_stat ORDER BY collection, stat_id`);
  const maps = await rows(`SELECT collection, map_id, mapping_fn FROM base_map ORDER BY collection, map_id`);
  const refs = await rows(`SELECT subject, system, identity, url, delta, relation FROM base_reference WHERE subject_kind='collection' ORDER BY subject, system`);
  const oeis = await rows(`SELECT collection, a_number, name FROM base_oeis WHERE collection IS NOT NULL ORDER BY collection, a_number`);
  const twins = await rows(`SELECT collection, head, arity FROM base_compute_engine_twin ORDER BY collection`);

  const out: CatalogEmit = {};
  const ensure = (id: string): CatalogCollection =>
    (out[id] ??= { title: null, carrier: null, unbounded: false, aliasOf: null, axes: [], params: [], stats: [], maps: [], xrefs: [], oeis: [], computeEngineTwin: null });

  for (const r of cat) {
    const c = ensure(r.id);
    c.title = r.title ?? null; c.carrier = r.carrier ?? null; c.unbounded = !!r.unbounded; c.aliasOf = r.alias_of ?? null;
  }
  for (const g of grades) {
    const c = out[g.collection]; if (!c) continue;
    (g.role === "param" ? c.params : c.axes).push({ pos: g.pos, name: g.name, lo: g.lo_expr, hi: g.hi_expr, admissible: g.admissible });
  }
  for (const s of stats) out[s.collection]?.stats.push({ id: s.stat_id, title: s.title, codomain: s.codomain });
  for (const m of maps) out[m.collection]?.maps.push({ id: m.map_id, fn: m.mapping_fn });
  for (const r of refs) out[r.subject]?.xrefs.push({ system: r.system, identity: r.identity, url: r.url, delta: r.delta, relation: r.relation });
  for (const o of oeis) out[o.collection]?.oeis.push({ a: o.a_number, name: o.name });
  for (const t of twins) { const c = out[t.collection]; if (c) c.computeEngineTwin = { head: t.head, arity: Number(t.arity) }; }
  return out;
}

/** Load the committed emit (build-time consumers read this, never the DB directly). */
export function loadCatalog(): CatalogEmit {
  return existsSync(outFile) ? (JSON.parse(readFileSync(outFile, "utf8")) as CatalogEmit) : {};
}

async function main() {
  const check = process.argv.includes("--check");
  const data = await emit();
  const json = JSON.stringify(data, null, 2) + "\n";
  const current = existsSync(outFile) ? readFileSync(outFile, "utf8") : null;
  if (check) {
    if (current !== json) { console.error("catalog.json is stale — re-run emit-catalog.mts"); process.exit(1); }
    console.log(`ok — catalog.json in sync (${Object.keys(data).length} collections)`);
    return;
  }
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, json);
  console.log(`emitted ${Object.keys(data).length} collections → _generated/catalog.json`);
}

// run as a script (not when imported for loadCatalog)
if (import.meta.url === `file://${process.argv[1]}`) { await main(); process.exit(0); }
