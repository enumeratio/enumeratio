// The THIN registry — the small, always-loaded symbol graph: what symbols exist, how they're spelled/parse, and
// the typed cross-walk links between them. Heavy detail (full prose, worked examples, glyphs, impl) loads lazily
// by id and is NOT here. The graph is assembled from two sources:
//   • the DB emit (_generated/catalog.json) — the catalog is source of truth (counts, axes, stats, maps, refs)
//   • the authored docs overlay (nodes.ts) — taglines/prose + symbols the catalog doesn't hold yet
//     (function↔sequence splits, disambiguation aliases, q-analog stubs), plus explicit links not derivable.
// Where the two disagree the catalog wins on facts; the overlay wins on prose. As symbols move INTO the catalog,
// their overlay entries shrink to nothing — that's the intended direction (data-driven, runtime-extensible later).
import { loadCatalog, type CatalogCollection } from "./emit-catalog.mts";

export type SymbolKind = "collection" | "function" | "sequence" | "stat" | "map" | "alias";

// The cross-walk relation vocabulary. `same` is the sameAs backbone (only these render as External references);
// everything else is an internal typed link to the entity that actually owns the concept.
export type RelationKind =
  | "same"          // this external system / symbol IS this concept (Wikipedia, MathWorld, OEIS-as-object, …)
  | "cardinality-of" // → the counting sequence for a given fibration (per-axis)
  | "recovers"      // function → the sequence it computes (Factorial → FactorialNumber)
  | "analog-of"     // q-analog / generating function (QFactorial → Factorial)
  | "alt-sort"      // same underlying set, different canonical order, bijection-linked (Permutations ↔ SymmetricGroup)
  | "isomorph"      // a genuinely different-but-isomorphic entity, bijection-linked
  | "stat-of"       // a statistic defined on this collection
  | "map-of"        // a bijection/morphism out of this collection
  | "see"           // disambiguation ("did you mean …")
  | "related";      // weaker association

export interface Link {
  rel: RelationKind;
  to?: string;              // target symbol id (internal)
  system?: string;          // external system (base_reference), when this is an external link
  identity?: string;        // the external declaration/name
  url?: string | null;
  note?: string;            // delta / clarification
  fibration?: string;       // for cardinality-of: which axis the count is over
}

export interface SymbolNode {
  id: string;               // canonical id — PascalCase for library heads/functions/collections
  kind: SymbolKind;
  aliases: string[];
  family?: string;
  tagline?: string;
  argForms?: string[];      // parse/interaction hints (e.g. "BellB(n)", "BellB(n, x)")
  catalogId?: string;       // join key into the DB emit (snake)
  links: Link[];
}

// ── deriving typed links from a collection's emitted catalog facts ──
// The catalog's base_reference.relation is imperfect (an OEIS 'cardinality only' row is tagged isomorphic, etc.),
// so the mapping here encodes the INTENDED cross-walk semantics; tightening the catalog data (base_reference
// relation repair, re-homing A000142 off permutations) is the companion follow-up so this can simplify.
const SAME_SYSTEMS = new Set(["wikipedia", "mathworld", "sage", "mathlib4", "sympy", "matlab", "wolfram", "dlmf", "fungrim"]);

export function deriveLinks(cat: CatalogCollection): Link[] {
  const links: Link[] = [];
  const axisName = cat.axes[0]?.name; // the primary fibration; per-axis cardinality refines this later

  for (const x of cat.xrefs) {
    const cardinalityish = x.system === "oeis" || /cardinality/i.test(x.delta);
    if (cardinalityish) {
      links.push({ rel: "cardinality-of", system: x.system, identity: x.identity, url: x.url, note: x.delta || undefined, fibration: axisName });
    } else if (SAME_SYSTEMS.has(x.system) && (x.relation === "isomorphic" || x.relation === "conceptual")) {
      links.push({ rel: "same", system: x.system, identity: x.identity, url: x.url, note: x.delta || undefined });
    } else {
      links.push({ rel: "related", system: x.system, identity: x.identity, url: x.url, note: x.delta || undefined });
    }
  }
  for (const o of cat.oeis) links.push({ rel: "cardinality-of", system: "oeis", identity: o.a, url: `https://oeis.org/${o.a}`, note: o.name || undefined, fibration: axisName });
  for (const s of cat.stats) links.push({ rel: "stat-of", to: s.id, note: s.title || undefined });
  for (const m of cat.maps) links.push({ rel: "map-of", to: m.id });
  return links;
}

/** Build the thin registry for the collection symbols the catalog knows (the DB half). The authored overlay
 *  (function/sequence/alias symbols + prose) is merged on top by the caller; kept separate here so the DB
 *  contribution is inspectable on its own. */
export function catalogSymbols(): Map<string, SymbolNode> {
  const emit = loadCatalog();
  const m = new Map<string, SymbolNode>();
  for (const [id, cat] of Object.entries(emit)) {
    if (cat.aliasOf) continue; // aliases fold into their canonical below via a `see` link on the canonical side
    m.set(id, { id, kind: "collection", aliases: [], family: undefined, tagline: cat.title ?? undefined, catalogId: id, links: deriveLinks(cat) });
  }
  return m;
}

// demo: `node --import tsx registry.ts permutations` prints one derived thin node
if (import.meta.url === `file://${process.argv[1]}`) {
  const id = process.argv[2] ?? "permutations";
  const node = catalogSymbols().get(id);
  console.log(JSON.stringify(node, null, 2));
  const byRel: Record<string, number> = {};
  for (const l of node?.links ?? []) byRel[l.rel] = (byRel[l.rel] ?? 0) + 1;
  console.log("link counts by relation:", byRel);
  process.exit(0);
}
