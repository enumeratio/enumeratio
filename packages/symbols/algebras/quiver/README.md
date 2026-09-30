# @enumeratio/quiver

Path-algebra extensions for compute-engine: quivers, their paths, and the path algebra
$kQ$ — finite-dimensional exactly when the quiver is acyclic. $kQ$'s basis is all directed
paths (one trivial path per vertex included), and like the incidence algebra most products
are zero: `p · q` is `pq` only when `q` starts where `p` ends. Unlike every other family in
this section, $kQ$ need not be finite-dimensional. See [the guide](docs/path-algebras.md).

## Declaring

```ts
import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareQuiver } from "@enumeratio/quiver";

const ce = new ComputeEngine();
declareQuiver(ce);
```

## Heads

- **Quivers** — [`Quiver`](https://enumeratio.dev/reference/symbol/Quiver),
  [`LinearQuiver`](https://enumeratio.dev/reference/symbol/LinearQuiver),
  [`QuiverIsAcyclic`](https://enumeratio.dev/reference/symbol/QuiverIsAcyclic)
- **Paths** — [`QuiverPath`](https://enumeratio.dev/reference/symbol/QuiverPath),
  [`QuiverPathEnd`](https://enumeratio.dev/reference/symbol/QuiverPathEnd),
  [`QuiverCompose`](https://enumeratio.dev/reference/symbol/QuiverCompose)
- **The algebra** — [`PathAlgebra`](https://enumeratio.dev/reference/symbol/PathAlgebra)

`src/quiver.ts` also exports `jordanQuiver` and `kroneckerQuiver` (the single-loop and
two-parallel-arrow quivers used to illustrate finite vs. infinite dimension), plus
`adjacency`, `allPaths` and `hasCycle` for computing on quivers directly.

## Usage

```
QuiverIsAcyclic(LinearQuiver(4))              // True
QuiverIsAcyclic(JordanQuiver)                 // False
AlgebraDimension(PathAlgebra(LinearQuiver(4))) // has a value
QuiverPathEnd(LinearQuiver(4), QuiverPath(1, [0, 1]))   // 3
```

## Next

A single loop gives the Jordan quiver, whose path algebra is $k[x]$ — no finite basis, so
`Basis` and `AlgebraDimension` leave the call standing rather than enumerating forever; the
guide walks through why.
