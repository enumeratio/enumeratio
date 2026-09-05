# `<enumeratio-figure>`

Client-backed. The full **figures-as-data** round-trip: it resolves an element's page-space SVG from the db
(`handle.glyphSvg(rank)` → pg's `glyph_svg(<carrier>)`) and hands the string to the generic
[`<svg-figure>`](/develop/packages/components/svg-figure) to draw. Geometry authored in SQL, resolved by the client, injected
by a generic element — no per-glyph TypeScript.

Needs a Db via `provideDb()` (the docs set it up globally).

## Attributes

| attribute | type | meaning |
|---|---|---|
| `collection` | string | the collection id |
| `n` | number | the size parameter |
| `rank` | number | the element's rank |

The db covers the three page-space kinds — a path (`lattice_path_svg`), a Ferrers diagram (`ferrers_svg`), and 0/1
cells (`cells_svg`) — each a `glyph_svg(<carrier>)` overload, so the **same** element renders all of them. A carrier
with no overload yields a quiet hint. Emits a `result` event with `value = 'ok'` once a figure resolves (a coarse
"did it render?" signal), so an assert can flag a missing/failed glyph.

## Usage

```html
<enumeratio-figure collection="dyck_paths" n="3" rank="0"></enumeratio-figure>
<enumeratio-figure collection="integer_partitions" n="6" rank="2"></enumeratio-figure>
<enumeratio-figure collection="binary_words" n="4" rank="6"></enumeratio-figure>
```

<p>
<enumeratio-figure collection="dyck_paths" n="3" rank="0"></enumeratio-figure>
<enumeratio-figure collection="dyck_paths" n="3" rank="4"></enumeratio-figure>
<enumeratio-figure collection="integer_partitions" n="6" rank="2"></enumeratio-figure>
<enumeratio-figure collection="binary_words" n="4" rank="6"></enumeratio-figure>
</p>

## Self-checking demos

`expect="ok"` asserts the db produced a figure for the collection:

<enumeratio-assert-summary label="figure checks"></enumeratio-assert-summary>

<p>
<enumeratio-assert expect="ok" reveal="always" label="dyck_paths renders">
  <enumeratio-figure collection="dyck_paths" n="3" rank="0"></enumeratio-figure>
</enumeratio-assert>
&nbsp;
<enumeratio-assert expect="ok" reveal="always" label="integer_partitions renders">
  <enumeratio-figure collection="integer_partitions" n="6" rank="2"></enumeratio-figure>
</enumeratio-assert>
</p>

This is the augmentable path: a new representation is a catalog row + a SQL function, no recompile — see
[render assets](https://github.com/enumeratio/enumeratio/wiki/Render-Assets) for the three-layer model.
