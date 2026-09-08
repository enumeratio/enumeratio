// Pure renderer: a resolved NodeDoc → the page's markdown. No kernel access, no IO — every {placeholder}
// has already been substituted by generate.mts against the live kernels, so this file only lays out the
// fixed page template (H1 → tagline → Usage → Details → Examples → See also). The template shape is the
// contract every reference page follows; change it here and every page regenerates.

export type NodeKind = "collection" | "primitive" | "listop" | "sequence" | "operator" | "view" | "symbol";

export interface UsageForm {
  /** KaTeX source WITHOUT the surrounding `$…$` (the renderer adds them). May contain {placeholders}. */
  form: string;
  /** one-line gloss (markdown/KaTeX inline allowed). */
  meaning: string;
}

export interface DetailItem {
  label: string;
  /** markdown/KaTeX body; may contain {placeholders} and source-file `code spans`. */
  body: string;
}

export interface SeeAlso {
  /** the sibling head, verbatim. Linked iff a page for it exists (generate.mts decides); else a code span. */
  head: string;
  /** optional parenthetical note after the link. */
  note?: string;
}

/** How a collection page's Examples numbers are computed — all values come from the real pack kernels. */
export interface CollectionExamples {
  /** sample parameters the bare {count}/{first(..)}/{at(..)} placeholders bind to. */
  params: number[];
  /** authored example paragraphs; {placeholders} resolve against `params` (or explicit args). */
  narrative: string[];
  /** LaTeX lines seeding a live, editable notebook embedded under the worked examples — each one
   *  evaluates in-browser (pure-CE, no pg). {placeholders} resolve here too. Same forms readers see in
   *  the narrative, now runnable. Omit for no live block. */
  notebook?: string[];
}

/** One external cross-reference, pulled from the catalog's `base_reference` table at generate time
 *  (single source of truth) — mathlib4 / sage / sympy / wikipedia / wolfram / matlab / oeis / … */
export interface XRef {
  system: string;
  identity: string;
  url: string | null;
  delta: string;
  relation: string;
}

export interface NodeDoc {
  head: string;
  /** Route/filename. Optional — defaults to the head itself (the canonical PascalCase identifier), so
   *  `SymmetricGroup` → /reference/SymmetricGroup. Set only to override. */
  slug?: string;
  /** The pg-catalog collection id (snake) this head corresponds to, when there is a twin. Join key for
   *  external cross-references (base_reference) and OEIS, and the basis of the "Catalog alias" note. */
  catalogId?: string;
  /** sidebar/grouping family label, e.g. "Permutations & permutation classes". */
  family: string;
  kind: NodeKind;
  /** the italic one-line definition under the H1. */
  tagline: string;
  usage: UsageForm[];
  details: DetailItem[];
  examples?: CollectionExamples;
  /** free-form example markdown for non-collection nodes (no kernel computation). */
  examplesRaw?: string[];
  seeAlso: SeeAlso[];
}

/** A resolved node is a NodeDoc whose placeholder strings are already substituted, plus per-see-also link info
 *  and the external cross-references pulled from the catalog (ordered, display-labelled). */
export interface ResolvedNode extends NodeDoc {
  seeAlsoResolved: { text: string; link?: string; note?: string }[];
  xrefsResolved?: { label: string; identity: string; url: string | null; delta: string; relation: string }[];
}

export function renderPage(n: ResolvedNode): string {
  const out: string[] = [];
  out.push(`# ${n.head}`, "");
  out.push(`*${n.tagline}*`, "");

  out.push("## Usage", "");
  out.push("| Form | Meaning |", "|---|---|");
  for (const u of n.usage) out.push(`| $${u.form}$ | ${u.meaning} |`);
  out.push("");

  out.push("## Details", "");
  for (const d of n.details) out.push(`- **${d.label}:** ${d.body}`);
  out.push("");

  const exampleLines = n.examples?.narrative ?? n.examplesRaw;
  if (exampleLines && exampleLines.length) {
    out.push("## Examples", "");
    for (const p of exampleLines) out.push(p, "");
  }

  // Live, editable notebook seeded with the same forms — evaluates in-browser (pure-CE). ClientOnly because
  // the custom element + engine are browser-only (Node prerender skips it). The value attribute is a JSON
  // NotebookSeed; single-quoted so the JSON's own double quotes need no escaping (only `'` and `&` do).
  if (n.examples?.notebook && n.examples.notebook.length) {
    const seed = JSON.stringify({ lines: n.examples.notebook.map((latex) => ({ latex })) })
      .replace(/&/g, "&amp;")
      .replace(/'/g, "&#39;");
    out.push("Try it live — edit any line and it re-evaluates (nothing here is a screenshot):", "");
    out.push("<ClientOnly>", `  <enumeratio-notebook value='${seed}'></enumeratio-notebook>`, "</ClientOnly>", "");
  }

  out.push("## See also", "");
  out.push(
    n.seeAlsoResolved
      .map((s) => {
        const base = s.link ? `[\`${s.text}\`](${s.link})` : `\`${s.text}\``;
        return s.note ? `${base} (${s.note})` : base;
      })
      .join(" · "),
  );
  out.push("");

  // External references — the same object in other systems, pulled from the catalog's base_reference table
  // (verified URLs + deltas). A `relation` other than isomorphic is flagged; a non-empty delta is shown verbatim.
  if (n.xrefsResolved && n.xrefsResolved.length) {
    out.push("## External references", "");
    for (const x of n.xrefsResolved) {
      const target = x.url ? `[${x.identity}](${x.url})` : `\`${x.identity}\``;
      const qual = x.relation !== "isomorphic" && x.relation !== "conceptual" ? ` _(${x.relation})_` : "";
      const delta = x.delta ? ` — ${x.delta}` : "";
      out.push(`- **${x.label}** — ${target}${qual}${delta}`);
    }
    out.push("");
  }
  return out.join("\n");
}
