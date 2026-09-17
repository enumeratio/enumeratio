import { html, LitElement, type PropertyValues } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { type GlyphKind, renderGlyph } from "./glyphs.ts";
import { ensureStyles } from "./styles.ts";

const KINDS = new Set<GlyphKind>([
  "permutation",
  "partition",
  "tableau",
  "composition",
  "subset",
  "dyck",
  "tree",
  "binary-tree",
  "set-partition",
  "lattice",
  "diagram",
]);

/** Parse a MathJSON-ish integer list from an attribute: `[3,1,2]` or `3,1,2`. */
function parseList(value: string): number[] {
  const text = value.trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text.startsWith("[") ? text : `[${text}]`);
    if (Array.isArray(parsed)) return parsed.map(Number).filter((x) => Number.isFinite(x));
  } catch {
    // fall through to an empty glyph rather than throwing in render
  }
  return [];
}

/**
 * `<notatio-figure kind="permutation" value="[3,1,2]">` -- renders a
 * combinatorial element as an inline SVG glyph. `kind` is one of permutation,
 * partition, composition, subset, dyck, tree (preorder child-count word),
 * binary-tree (preorder shape word, 1 = internal); `value` is the element as an
 * integer list. `subset` also reads `n` (the ground-set size). Pass a ready-made `svg`
 * string instead to render it verbatim (the generic escape hatch).
 */
export class NotatioFigure extends LitElement {
  // `kind` is reflected so CSS can size a kind differently — a VitePress host binds
  // these as PROPERTIES, not attributes, so without it `notatio-figure[kind=…]` never
  // matches.
  static properties = {
    /** Which glyph to draw: `permutation`, `partition`, `composition`, `subset` or `dyck`. */
    kind: { type: String, reflect: true },
    /** The element as an integer list, `[3,1,2]` or `3,1,2`. */
    value: { type: String },
    /** Ground-set size, where the glyph needs one beyond the element itself. */
    n: { type: Number },
    /** Raw SVG to render instead of a generated glyph. */
    svg: { type: String },
  };

  declare kind: string;
  declare value: string;
  declare n: number | undefined;
  declare svg: string;

  constructor() {
    super();
    this.kind = "";
    this.value = "";
    this.n = undefined;
    this.svg = "";
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  #markup(): string {
    if (this.svg) return this.svg;
    if (!KINDS.has(this.kind as GlyphKind)) return "";
    return renderGlyph(this.kind as GlyphKind, parseList(this.value), { n: this.n });
  }

  protected override shouldUpdate(changed: PropertyValues): boolean {
    return changed.has("kind") || changed.has("value") || changed.has("n") || changed.has("svg");
  }

  protected override render(): unknown {
    return html`${unsafeHTML(this.#markup())}`;
  }
}

if (!customElements.get("notatio-figure")) {
  customElements.define("notatio-figure", NotatioFigure);
}
