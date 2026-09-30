# @enumeratio/incidence

Incidence-algebra extensions for compute-engine: finite posets, the zeta and Möbius
functions, and Möbius inversion. The algebra's basis is indexed by a poset's
**intervals**, and the product is composition — composable intervals compose, everything
else annihilates. That makes it the first family in this section whose product is usually
zero. See [the guide](docs/incidence-algebras.md).

## Declaring

```ts
import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareIncidence } from "@enumeratio/incidence";

const ce = new ComputeEngine();
declareIncidence(ce);
```

## Heads

- **Posets** — [`Chain`](https://enumeratio.dev/reference/symbol/Chain),
  [`BooleanLattice`](https://enumeratio.dev/reference/symbol/BooleanLattice),
  [`DivisorLattice`](https://enumeratio.dev/reference/symbol/DivisorLattice),
  [`PosetElements`](https://enumeratio.dev/reference/symbol/PosetElements),
  [`PosetInterval`](https://enumeratio.dev/reference/symbol/PosetInterval)
- **The algebra** — [`IncidenceAlgebra`](https://enumeratio.dev/reference/symbol/IncidenceAlgebra),
  [`PosetZeta`](https://enumeratio.dev/reference/symbol/PosetZeta),
  [`PosetSumDown`](https://enumeratio.dev/reference/symbol/PosetSumDown)
- **Möbius** — [`MoebiusFunction`](https://enumeratio.dev/reference/symbol/MoebiusFunction),
  [`MoebiusInvert`](https://enumeratio.dev/reference/symbol/MoebiusInvert)

`src/poset.ts` also exports the underlying `Poset` model directly — `matrixOf`, `zeta`,
`moebius`, `convolve` — for computing on posets without going through compute-engine.

## Usage

```
MoebiusFunction(DivisorLattice(30), 1, 30)   // -1 — squarefree, three primes
MoebiusFunction(DivisorLattice(12), 1, 12)   //  0 — 4 divides 12
MoebiusFunction(BooleanLattice(3), [], [1, 2, 3])   // -1 — inclusion–exclusion
```

## Next

The guide's central fact is $\zeta * \mu = \delta$, checked as a matrix identity on
every poset here — that identity is what forces $\mu$'s recursive definition and what
Möbius inversion rests on.
