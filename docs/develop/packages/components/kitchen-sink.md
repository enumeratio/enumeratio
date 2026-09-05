---
sidebar: false
aside: false
---

# Figure kitchen sink

Every carrier the db knows how to draw, rendered **from SQL** — one live [`<enumeratio-figure>`](/develop/packages/components/figure)
per page-space glyph. Each figure resolves an element's SVG straight from pg's `glyph_svg(<carrier>)` (the
**figures-as-data** round-trip) and hands the string to the generic [`<svg-figure>`](/develop/packages/components/svg-figure) to
inject — no per-glyph TypeScript. Every demo is wrapped in [`<enumeratio-assert>`](/develop/packages/components/assert) with
`expect="ok"`, so this page is **itself a full-stack test run**: the scoreboard should read *all passing*.

Which carriers render is not a hand-kept list — `carrier_renders_svg(<carrier>)` is derived from the `glyph_svg`
overloads in the db, so a new carrier's glyph lights up here the moment its SQL function exists. See
[render assets](https://github.com/enumeratio/enumeratio/wiki/Render-Assets) for the three-layer model.

<enumeratio-assert-summary label="figure demos"></enumeratio-assert-summary>

## Ferrers diagram — `integer_partition`

Rows of boxes, one per part (`ferrers_svg`). The partition `6 = 3+2+1` at rank 2 of `integer_partitions(6)`:

```html
<enumeratio-figure collection="integer_partitions" n="6" rank="2"></enumeratio-figure>
```

<p>
<enumeratio-assert expect="ok" reveal="always" label="ferrers renders">
  <enumeratio-figure collection="integer_partitions" n="6" rank="2"></enumeratio-figure>
</enumeratio-assert>
</p>

## Lattice path — `dyck_path` / `motzkin_path`

A walk in page space, filled under the curve (`lattice_path_svg`). The two path carriers share one generator, so the
**same** SVG code draws both — a Dyck path (±1 steps) and a Motzkin path (level steps allowed):

```html
<enumeratio-figure collection="dyck_paths" n="3" rank="0"></enumeratio-figure>
<enumeratio-figure collection="motzkin_paths" n="4" rank="0"></enumeratio-figure>
```

<p>
<enumeratio-assert expect="ok" reveal="always" label="dyck path renders">
  <enumeratio-figure collection="dyck_paths" n="3" rank="0"></enumeratio-figure>
</enumeratio-assert>
&nbsp;
<enumeratio-assert expect="ok" reveal="always" label="motzkin path renders">
  <enumeratio-figure collection="motzkin_paths" n="4" rank="0"></enumeratio-figure>
</enumeratio-assert>
</p>

## Cells — `binary_word`

A row of labelled 0/1 cells, filled where the bit is set (`cells_svg`). Rank 6 of `binary_words(4)`:

```html
<enumeratio-figure collection="binary_words" n="4" rank="6"></enumeratio-figure>
```

<p>
<enumeratio-assert expect="ok" reveal="always" label="cells render">
  <enumeratio-figure collection="binary_words" n="4" rank="6"></enumeratio-figure>
</enumeratio-assert>
</p>

## Subset register — `finset` over `[n]`

A subset renders through the **`finset`** carrier, the same path the client always takes (`glyph_svg((e).value)`). The
finset value carries the fiber's ground `n`, so the register is fiber-aware for free: a subset of `[3]` draws a
**length-3** indicator, filled at its members. Rank 4 of `subsets(3)` is `{1,2}` ↦ `110`:

```html
<enumeratio-figure collection="subsets" n="3" rank="4"></enumeratio-figure>
```

<p>
<enumeratio-assert expect="ok" reveal="always" label="subset register renders">
  <enumeratio-figure collection="subsets" n="3" rank="4"></enumeratio-figure>
</enumeratio-assert>
</p>

## Finite set of ℕ — `finset` (unbounded)

The **same** `finset` carrier with no ground (`α = ℕ`): the register spans up to the largest member instead of a fixed
`[n]`. Rank 3 of the ungraded `finsets` collection is `{1,2}`:

```html
<enumeratio-figure collection="finsets" rank="3"></enumeratio-figure>
```

<p>
<enumeratio-assert expect="ok" reveal="always" label="finset renders">
  <enumeratio-figure collection="finsets" rank="3"></enumeratio-figure>
</enumeratio-assert>
</p>

## Sequence bars — `ascent_sequence` / `subexcedant_seq` / `rgs_word` / `gray_code` / `ternary_gray_code`

Five carriers share one generator (`sequence_bar_svg`, hosted in `ascent_sequence_glyph.sql`): a bar per term,
height proportional to the value, labelled underneath so a 0-valued term still reads. Rank 0 of each:

```html
<enumeratio-figure collection="ascent_sequences" n="3" rank="0"></enumeratio-figure>
<enumeratio-figure collection="restricted_growth_strings" n="3" rank="0"></enumeratio-figure>
<enumeratio-figure collection="gray_codes" n="3" rank="0"></enumeratio-figure>
```

<p>
<enumeratio-assert expect="ok" reveal="always" label="ascent_sequence renders">
  <enumeratio-figure collection="ascent_sequences" n="3" rank="0"></enumeratio-figure>
</enumeratio-assert>
&nbsp;
<enumeratio-assert expect="ok" reveal="always" label="rgs_word renders">
  <enumeratio-figure collection="restricted_growth_strings" n="3" rank="0"></enumeratio-figure>
</enumeratio-assert>
&nbsp;
<enumeratio-assert expect="ok" reveal="always" label="gray_code renders">
  <enumeratio-figure collection="gray_codes" n="3" rank="0"></enumeratio-figure>
</enumeratio-assert>
</p>

## Permutation arc diagram — `decorated_permutation` / `arrangement` / `affine_permutation`

Points on a baseline, arcs bowing below for `i → image[i]`, tangent loops for fixed points (`permutation_arc_svg`,
hosted in `decorated_permutation_glyph.sql`). A per-position `decorated` flag draws a dashed stroke and hollow point:
a decorated fixed point for `decorated_permutation`, a wound (winding ≠ 0) position for `affine_permutation`.
`arrangement`'s partial word leaves unused rows as bare points, the same "no mark here" convention
`rook_placement_grid_svg` uses.

```html
<enumeratio-figure collection="decorated_permutations" n="3" rank="0"></enumeratio-figure>
<enumeratio-figure collection="affine_permutations" n="3" rank="0"></enumeratio-figure>
```

<p>
<enumeratio-assert expect="ok" reveal="always" label="decorated_permutation renders">
  <enumeratio-figure collection="decorated_permutations" n="3" rank="0"></enumeratio-figure>
</enumeratio-assert>
&nbsp;
<enumeratio-assert expect="ok" reveal="always" label="affine_permutation renders">
  <enumeratio-figure collection="affine_permutations" n="3" rank="0"></enumeratio-figure>
</enumeratio-assert>
</p>

## Signed bar row — `signed_subset`

The cross-polytope vertex/face, read as a row of `n` cells: a filled dot for a present `+k`, a hollow ring for a
present `−k`, blank for an absent axis.

```html
<enumeratio-figure collection="signed_subsets" n="2" rank="0"></enumeratio-figure>
```

<p>
<enumeratio-assert expect="ok" reveal="always" label="signed_subset renders">
  <enumeratio-figure collection="signed_subsets" n="2" rank="0"></enumeratio-figure>
</enumeratio-assert>
</p>

## Bipartite diagram — `surjection`

Domain points on top, codomain (block) points on bottom, one connecting line per domain point — surjectivity reads
directly off the picture, since every codomain point is guaranteed to receive a line.

```html
<enumeratio-figure collection="surjections" n="3" rank="0"></enumeratio-figure>
```

<p>
<enumeratio-assert expect="ok" reveal="always" label="surjection renders">
  <enumeratio-figure collection="surjections" n="3" rank="0"></enumeratio-figure>
</enumeratio-assert>
</p>

## Functional graph — `endofunction`

Points on a circle, a chord with an arrowhead for every `i → f(i)`, a small loop tangent to the circle for a fixed
point — the classic picture for a general (non-injective, non-surjective) function `[n]→[n]`.

```html
<enumeratio-figure collection="endofunctions" n="3" rank="0"></enumeratio-figure>
```

<p>
<enumeratio-assert expect="ok" reveal="always" label="endofunction renders">
  <enumeratio-figure collection="endofunctions" n="3" rank="0"></enumeratio-figure>
</enumeratio-assert>
</p>

## Bar row with gaps — `weak_composition`

The same divided-bar picture as `composition`'s `composition_bar_svg`, but a zero part draws a small dashed,
unfilled "gap" segment instead of vanishing at width 0 — every part stays visible and countable.

```html
<enumeratio-figure collection="weak_compositions_into_k_parts" n="3" rank="0"></enumeratio-figure>
```

<p>
<enumeratio-assert expect="ok" reveal="always" label="weak_composition renders">
  <enumeratio-figure collection="weak_compositions_into_k_parts" n="3" rank="0"></enumeratio-figure>
</enumeratio-assert>
</p>

## Dot columns — `multiset`

One column per ground element, a stack of dots (bottom-up) whose height is that element's multiplicity — a
tally-mark histogram of the multiset.

```html
<enumeratio-figure collection="multisets" n="3" rank="0"></enumeratio-figure>
```

<p>
<enumeratio-assert expect="ok" reveal="always" label="multiset renders">
  <enumeratio-figure collection="multisets" n="3" rank="0"></enumeratio-figure>
</enumeratio-assert>
</p>

## Skew Young diagram — `skew_partition` / `core_partition`

`skew_partition` draws the outer shape's Young diagram with the inner shape's cells faded/hollow instead of solid
— "outer minus inner" read directly off the picture. `core_partition` is exactly a non-increasing parts array, so
it dispatches straight to the plain `ferrers_svg` above — no new geometry.

```html
<enumeratio-figure collection="skew_partitions" n="3" rank="0"></enumeratio-figure>
<enumeratio-figure collection="core_partitions" n="3" rank="0"></enumeratio-figure>
```

<p>
<enumeratio-assert expect="ok" reveal="always" label="skew_partition renders">
  <enumeratio-figure collection="skew_partitions" n="3" rank="0"></enumeratio-figure>
</enumeratio-assert>
&nbsp;
<enumeratio-assert expect="ok" reveal="always" label="core_partition renders">
  <enumeratio-figure collection="core_partitions" n="3" rank="0"></enumeratio-figure>
</enumeratio-assert>
</p>

## Polygon dissection — `dissection`

The `(n+2)`-gon (light outline) with each diagonal drawn as a chord — the faces of the associahedron.

```html
<enumeratio-figure collection="dissections" n="2" rank="0"></enumeratio-figure>
```

<p>
<enumeratio-assert expect="ok" reveal="always" label="dissection renders">
  <enumeratio-figure collection="dissections" n="2" rank="0"></enumeratio-figure>
</enumeratio-assert>
</p>

## Plan-view grid — `plane_partition`

A labelled Young-diagram grid, one cell per (row, column) printing the stack height at that cell — a deliberate
simplification of a true isometric "stacked boxes" 3-view (see `plane_partition_glyph.sql`).

```html
<enumeratio-figure collection="plane_partitions" n="3" rank="0"></enumeratio-figure>
```

<p>
<enumeratio-assert expect="ok" reveal="always" label="plane_partition renders">
  <enumeratio-figure collection="plane_partitions" n="3" rank="0"></enumeratio-figure>
</enumeratio-assert>
</p>

---

Every figure above is a catalog row plus a SQL function — add a `glyph_svg` overload for a new carrier and it renders
here with no recompile. For the element in isolation see [`<enumeratio-figure>`](/develop/packages/components/figure); for the
pure, SVG-in renderer it hands off to see [`<svg-figure>`](/develop/packages/components/svg-figure).
