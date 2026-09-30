# @enumeratio/geometric

The geometric-algebra layer over [`@enumeratio/hypercomplex`](../hypercomplex/README.md): grade
projection, the outer and regressive products, the contractions, the involutions and the
Poincaré dual. Where `@enumeratio/hypercomplex` gives a Clifford algebra its arithmetic, this
package gives a multivector its **structure** — which blades it lives in, and the operations
that only make sense once grade is in view.

## Declaring

```ts
import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareHypercomplex } from "@enumeratio/hypercomplex";
import { declareGeometric } from "@enumeratio/geometric";

const ce = new ComputeEngine();
declareHypercomplex(ce);
declareGeometric(ce);
```

`declareGeometric` needs the units declared first — it operates on the multivectors
`@enumeratio/hypercomplex` already knows how to add and multiply.

## Heads

- **Products** — [`Wedge`](https://enumeratio.dev/reference/symbol/Wedge) (outer),
  [`LeftContraction`](https://enumeratio.dev/reference/symbol/LeftContraction) /
  [`RightContraction`](https://enumeratio.dev/reference/symbol/RightContraction),
  [`ScalarProduct`](https://enumeratio.dev/reference/symbol/ScalarProduct),
  [`GeometricProduct`](https://enumeratio.dev/reference/symbol/GeometricProduct),
  [`Sandwich`](https://enumeratio.dev/reference/symbol/Sandwich) (versor action)
- **Grade** — [`Grade`](https://enumeratio.dev/reference/symbol/Grade),
  [`GradePart`](https://enumeratio.dev/reference/symbol/GradePart),
  [`GradeInvolution`](https://enumeratio.dev/reference/symbol/GradeInvolution)
- **Duality** — [`Pseudoscalar`](https://enumeratio.dev/reference/symbol/Pseudoscalar),
  [`Dual`](https://enumeratio.dev/reference/symbol/Dual)
- **Reversal** — [`Reversion`](https://enumeratio.dev/reference/symbol/Reversion),
  [`CliffordConjugate`](https://enumeratio.dev/reference/symbol/CliffordConjugate)

## Usage

```
Wedge(e_1, e_2, e_1)     // 0 — a repeated generator kills the wedge
GeometricProduct(e_1, e_1)  // 1 — but the geometric product does not vanish
```

The wedge of two distinct generators is their blade and anticommutes:
`Wedge(e_1, e_2) = e_1e_2 = -Wedge(e_2, e_1)`; it is associative and linear in each
argument, so it folds over any number of operands.

## Next

`Sandwich` and `Dual` are the two operations most worth reading the source for
(`src/dual.ts`, `src/products.ts`) — the dual's sign depends on the ambient
[`AlgebraSignature`](https://enumeratio.dev/reference/symbol/AlgebraSignature), and the sandwich is
how reflections and rotations are actually built from versors.
