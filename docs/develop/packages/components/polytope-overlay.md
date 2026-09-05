# `<polytope-overlay>`

The multi-layer sibling of [`<polytope-figure>`](/develop/packages/components/polytope-figure): it lays **several polytopes
into one projective space** at once, so different collections' polytopes are seen together. Scene-space, WebGL
(three.js).

## Properties

| property | type | meaning |
|---|---|---|
| `layers` | `Layer[]` | one entry per polytope — its vertices, edges, and styling |
| `height` | number | canvas height in px (default `480`) |
| `scale` | number | zoom (default `2.4`) |

Each `Layer` carries the same geometry shape a single `<polytope-figure>` takes (vertices + edges), plus per-layer
presentation so the layers stay distinguishable in the shared space.

## Usage

Build each layer from the client's `polytope(collection, n)`, then hand the set to the overlay:

```ts
import { polytope } from '@enumeratio/client'

const layers = await Promise.all([
  polytope('set_compositions', 4),
  polytope('signed_subsets', 3),
])
document.querySelector('polytope-overlay')!.layers = layers.map((p, i) => ({ ...p, hue: i }))
```

## Live view

The explorer's **Projective** view drives this element with layer toggles and pan/zoom — that's the intended home for
the multi-layer picture. See the [Polytopes](/learn/explorations/polytopes) field guide for what the shared projective space means.
