# @enumeratio/hypercomplex

Hypercomplex-number extensions for compute-engine: multicomplex, split/perplex, dual and
Clifford unit families as ordinary subscripted symbols, wired into `+ - × ÷`, integer
powers, `Norm` and `Conjugate` with exact coefficients. Background and the family grid are
in [the guide](docs/hypercomplex-algebras.md); finite-quotient arithmetic (units mod n) is in
[its own page](docs/finite.md).

## Declaring

```ts
import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareHypercomplex } from "@enumeratio/hypercomplex";

const ce = new ComputeEngine();
declareHypercomplex(ce);
```

`./src` is also exported directly, for packages (like [`@enumeratio/geometric`](../geometric/README.md))
that build on the multivector internals rather than just the declared heads.

## A generator is two dials

Every unit is fixed by what it squares to and whether it commutes — the whole family
table is a 3×2 grid, `i_k` / `j_k` / `ε_k` (commuting) against Clifford's anticommuting
generators. The named algebras package up common corners of that grid:
[`Quaternions`](https://enumeratio.dev/reference/symbol/Quaternions) ($\mathrm{Cl}(0,2)$),
plus `BicomplexNumbers`, `TricomplexNumbers`, `SplitComplexNumbers` and `DualNumbers`.

## Heads

- **Signature and structure** — [`AlgebraSignature`](https://enumeratio.dev/reference/symbol/AlgebraSignature),
  [`Quaternions`](https://enumeratio.dev/reference/symbol/Quaternions),
  [`SplitAlgebra`](https://enumeratio.dev/reference/symbol/SplitAlgebra),
  [`DualAlgebra`](https://enumeratio.dev/reference/symbol/DualAlgebra),
  [`MulticomplexAlgebra`](https://enumeratio.dev/reference/symbol/MulticomplexAlgebra)
- **Arithmetic** — [`Expand`](https://enumeratio.dev/reference/symbol/Expand),
  [`Norm`](https://enumeratio.dev/reference/symbol/Norm)

`src/modular.ts` also exports the number-theoretic side of the units mod $n$ —
`imaginaryUnitsMod`, `splitUnitsMod`, `factorize` — used by the finite guide.

## Next

Read the guide for the multiplication-table construction and how canonicalisation
interacts with anticommuting generators; [`@enumeratio/geometric`](../geometric/README.md) is the
grade-aware layer built on top.
