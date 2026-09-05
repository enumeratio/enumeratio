# Visual representations — casts into spaces

An element is **data**. Every rendering of it is a **cast** of that data into a **space**, and each space has its own
**locating parameters**. Text, markup, and geometry are not different systems — they are the same element cast at
different targets. This page records that model and the shared theming every visual leans on.

## Spaces

| space | target | locating parameter | catalog registry | client renderer |
|---|---|---|---|---|
| **line** | ascii · unicode · latex | character position | `base_repr` (`render_fn` → text) | plain text / KaTeX |
| **page** | SVG · HTML | $(x, y)$ / flow | `glyph_svg(<carrier>)` (SVG out of the db) | `<svg-figure>` |
| **scene** | 2-, 3-, $n$-D geometry | a coordinate vector | `base_polytope` (dim / point / contains) | `PolytopeView` |

`base_repr`, `glyph_svg`, and `base_polytope` are one idea at three targets: a declaration, **in the catalog**, of how
the element data casts into a space. (The `medium` axis — ascii/unicode/latex — is the line-space sub-choice.)
Layout across web, print, and terminal is itself a family of spaces, each with locating parameters; the same element
can be cast into any of them.

## The data cast (pickling)

Element instances are *already* structural — the carrier is a pg composite (`integer_partition = (parts int[])`, …).
`to_jsonb((e).value)` casts that to a standard JSON form: a portable **pickle** of the element, surfaced by the
client's `data` window option as `__data`. Page/scene glyphs read it. The inverse,
`jsonb_populate_record(null::carrier, data)`, unpickles JSON back to the carrier — a round-trip to lean on for
import/export. *(The reverse direction is not yet wired.)*

## Theming — shared thematic properties

Glyphs are SVG that **borrow the app's theme** rather than hard-coding colours, so every visual — glyphs, the
polytope, the tables — reads as one system in light and dark. Emitted SVG references the shared `--enumeratio-*`
styling hooks (the public surface, defined from the design tokens in tokens.css §3c); component-internal chrome
may additionally fall back through the PrimeVue vars:

| role | hook (emitted SVG) | component fallback chain |
|---|---|---|
| primary accent (marks, fills, strokes) | `var(--enumeratio-accent, #d97706)` | → `--p-primary-color` |
| body text | `var(--enumeratio-text, currentColor)` | → `--p-text-color` |
| muted / secondary text | `var(--enumeratio-muted, currentColor)` | → `--p-text-muted-color` |
| borders · gridlines · axes | `var(--enumeratio-border, currentColor)` | → `--p-content-border-color` |
| surface · empty cell | `var(--enumeratio-bg, #fff)` | → `--p-content-background` |

Tints come from `color-mix(in srgb, var(--enumeratio-accent, #d97706) 16%, transparent)` — a translucent wash of
the accent, so fills track the theme and layer cleanly over one another. Keep each glyph `viewBox`-scaled with `width: 100%;
height: auto`, a sensible `max-width`, `overflow: visible`, and a `role="img"` + `aria-label`. A glyph should carry
no colour of its own — only roles.

## Adding a glyph

The geometry is **computed in SQL** — a glyph is a function from a carrier value to a self-contained SVG string, so a
whole window of elements comes back already drawn. One step:

1. **Declare the cast** — a `CREATE FUNCTION glyph_svg(p <carrier>) RETURNS text` overload in `sqlsrc/glyphs.sql`,
   returning a `viewBox`-scaled SVG that references the shared `--enumeratio-*` styling hooks (below).

Because `glyph_svg` dispatches on the **carrier**, one overload lights up every collection built on that type — the
integer-partition family all get the Ferrers diagram, the subset-shaped carriers all get cells, and so on.
`carrier_renders_svg(<carrier>)` is *derived* from the overloads (no second registry to keep in sync), and the client
reads it to decide when to ask for an SVG (its `glyph` window option projects `glyph_svg((e).value) AS __svg`).

## Framework-agnostic figures (web components)

The renderer is a single **Lit custom element** in `@enumeratio/components`, [`<svg-figure>`](/develop/packages/components/svg-figure):
it injects a ready-made SVG string verbatim, so the geometry is authored anywhere (notably by the db's `glyph_svg`) rather
than hardcoded in a per-glyph element. The client-backed [`<enumeratio-figure>`](/develop/packages/components/figure) closes the
loop — it resolves an element's SVG from the db and hands it to `<svg-figure>`. Live below — the same element drawn
straight from the catalog (a Dyck path, an integer partition, a binary word, a subset):

<div style="display:flex; gap:1.5rem; align-items:flex-end; flex-wrap:wrap; margin:1rem 0;">
  <enumeratio-figure collection="dyck_paths" n="3" rank="2"></enumeratio-figure>
  <enumeratio-figure collection="integer_partitions" n="6" rank="3"></enumeratio-figure>
  <enumeratio-figure collection="binary_words" n="5" rank="9"></enumeratio-figure>
  <enumeratio-figure collection="subsets" n="4" rank="6"></enumeratio-figure>
</div>

Colors follow the `--enumeratio-*` styling hooks (the docs and explorer define them from the design tokens;
standalone they fall back to sensible defaults). The `enumeratio-` prefix marks the client-backed,
enumeratio-resource components; the pure `-figure` renderer (`<svg-figure>`) carries only a semantic type suffix.
