# `<polytope-figure>`

Scene-space figure: a collection's elements placed as the vertices of a **polytope**, rendered in WebGL (three.js).
It emits a `select` `CustomEvent` when a vertex/face is clicked, so a host view can report the picked element back.
See the [Polytopes](/learn/explorations/polytopes) field guide for the mathematics.

This element carries the package's one heavier dependency, `three`, and takes its geometry as **properties** (fed from
JS), so it isn't an attribute-only drop-in like the pure glyphs.

## Properties

| property | type | meaning |
|---|---|---|
| `vertices` | `number[][]` | nD vertex coordinates |
| `edges` | `[number,number][]` | wireframe edges as vertex-index pairs |
| `cells` | `Cell[] \| null` | the face poset (each face's spanning vertex indices, dim, rank, label) |
| `labels` | `string[]` | per-vertex labels |
| `faces` | `number[][]` | filled faces as vertex-index lists |
| `selected` | `number \| null` | the currently highlighted vertex/face index |
| `height` | number | canvas height in px (default `460`) |
| `scale` | number | zoom (default `0.6`) |

Emits **`select`** — `event.detail` is the clicked cell index.

## Where the data comes from

The geometry is read generically from the db by the client's `polytope(collection, n)` — vertices are the
collection's dim-0 faces at their `point_fn` coordinate, edges its dim-1 faces. The registry that says which
collection casts into which polytope is `base_polytope` in [`@enumeratio/data`](/develop/packages/data/); list them with
`polytopeCollections()`.

```ts
import { polytope } from '@enumeratio/client'

const p = await polytope('set_compositions', 4) // → permutahedron
const el = document.querySelector('polytope-figure')!
el.vertices = p.vertices
el.edges = p.edges
el.cells = p.cells
el.addEventListener('select', (e) => console.log('picked cell', (e as CustomEvent).detail))
```

## Live view

The explorer's stateful **Projective** view is a Vue component built on top of this element (the web component owns
the GL and picking; the framework owns the app state). Browse it there:
[`set_compositions` → the permutahedron](/explore/collection/set_compositions),
[`signed_subsets` → the cross-polytope](/explore/collection/signed_subsets).
