// frontend's own carrier (https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step
// 5): moved from combinatorics' domains/LEFTOVER_DOMAINS, as an interim home — the roadmap
// will later make glyphs and renderers data in symbol metadata instead. Distinct from this
// package's own `GlyphKind` (glyphs.ts), which is an unrelated TypeScript union for the SVG
// glyph renderer, not a compute-engine carrier.

import type { Carrier } from "@enumeratio/structures";

export const FRONTEND_CARRIERS: readonly Carrier[] = [
  {
    name: "GlyphKind",
    type: "glyph_kind",
    shape: "tuple<string, string>",
    id: "glyph_kind",
    plural: "GlyphKinds",
  },
];
