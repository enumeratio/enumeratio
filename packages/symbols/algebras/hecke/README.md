# @enumeratio/hecke

Iwahori–Hecke algebra extensions for compute-engine: the $q$-deformation of the symmetric
group algebra, with $T$-basis multiplication over $\mathbb{Z}[q]$. $H_n(q)$ keeps the
symmetric-group basis exactly — one $T_w$ per permutation — and deforms only the product,
by one rule applied a simple reflection at a time. See [the guide](docs/hecke-algebras.md).

## Declaring

```ts
import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareHecke } from "@enumeratio/hecke";

const ce = new ComputeEngine();
declareHecke(ce);
```

## Heads

- [`HeckeAlgebra`](https://enumeratio.dev/reference/symbol/HeckeAlgebra) — the algebra itself,
  parameterised by $n$ (and $q$, symbolic unless specialized)
- [`HeckeT`](https://enumeratio.dev/reference/symbol/HeckeT) — the basis element $T_w$ for a
  permutation $w$
- [`HeckeIdentity`](https://enumeratio.dev/reference/symbol/HeckeIdentity) — $T_e$, the identity
  of the algebra
- [`HeckeSpecialize`](https://enumeratio.dev/reference/symbol/HeckeSpecialize) — substitute a
  value for $q$

`src/hecke.ts` exports the underlying `Element`/`Coefficients` model directly —
`multiply`, `multiplyByBasis`, `reducedWord`, `length` — for callers that want the
$T$-basis arithmetic without going through compute-engine.

## Usage

```
NonCommutativeMultiply(HeckeT([2, 1, 3]), HeckeT([1, 3, 2]))
  // HeckeT([2, 3, 1]) — length goes up, so no q appears

NonCommutativeMultiply(HeckeT([2, 1, 3]), HeckeT([2, 1, 3]))
  // HeckeParameter * HeckeT([1, 2, 3]) + (HeckeParameter - 1) * HeckeT([2, 1, 3]) — the quadratic relation

AlgebraDimension(HeckeAlgebra(4))   // 24 — n!, same basis as Z[S_n]
```

## Next

The guide has the length-up/length-down case split and works the braid relation
$T_sT_tT_s = T_tT_sT_t$ through to the longest element of $S_3$.
