# @enumeratio/modular

The modular group $\mathrm{PSL}(2,\mathbb{Z})$ for compute-engine: S/T and L/R words,
continued fractions, the Stern–Brocot tree, hyperbolic conjugacy classes as necklaces, and
the Rademacher symbol. The group is a free product $\mathbb{Z}/2 * \mathbb{Z}/3$, so every
element is a word and questions about the group become questions about words — the same
combinatorics this catalogue already counts elsewhere. See [the guide](docs/modular-group.md)
for the construction and the payoff: a conjugacy class as a knotted orbit, linked to the
trefoil by a number you read off the word.

## Declaring

```ts
import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareModular } from "@enumeratio/modular";

const ce = new ComputeEngine();
declareModular(ce);
```

## Heads

- **The group** — [`ModularMatrix`](https://enumeratio.dev/reference/symbol/ModularMatrix),
  [`ModularSTWord`](https://enumeratio.dev/reference/symbol/ModularSTWord),
  [`ModularWord`](https://enumeratio.dev/reference/symbol/ModularWord),
  [`ModularFromSTWord`](https://enumeratio.dev/reference/symbol/ModularFromSTWord),
  [`ModularTrace`](https://enumeratio.dev/reference/symbol/ModularTrace),
  [`ModularKind`](https://enumeratio.dev/reference/symbol/ModularKind)
- **Continued fractions** — [`ContinuedFraction`](https://enumeratio.dev/reference/symbol/ContinuedFraction),
  [`ContinuedFractionK`](https://enumeratio.dev/reference/symbol/ContinuedFractionK),
  [`Convergents`](https://enumeratio.dev/reference/symbol/Convergents),
  [`SternBrocotPath`](https://enumeratio.dev/reference/symbol/SternBrocotPath),
  [`FromSternBrocotPath`](https://enumeratio.dev/reference/symbol/FromSternBrocotPath),
  [`FareyNeighbours`](https://enumeratio.dev/reference/symbol/FareyNeighbours),
  [`PellSolution`](https://enumeratio.dev/reference/symbol/PellSolution)
- **Quadratic forms** — [`QuadraticForm`](https://enumeratio.dev/reference/symbol/QuadraticForm),
  [`FormDiscriminant`](https://enumeratio.dev/reference/symbol/FormDiscriminant),
  [`FormAction`](https://enumeratio.dev/reference/symbol/FormAction),
  [`ReduceForm`](https://enumeratio.dev/reference/symbol/ReduceForm),
  [`IsReducedForm`](https://enumeratio.dev/reference/symbol/IsReducedForm),
  [`FormCycle`](https://enumeratio.dev/reference/symbol/FormCycle),
  [`ReducedForms`](https://enumeratio.dev/reference/symbol/ReducedForms),
  [`FormClasses`](https://enumeratio.dev/reference/symbol/FormClasses),
  [`FormClassNumber`](https://enumeratio.dev/reference/symbol/FormClassNumber),
  [`IsPrimitiveClass`](https://enumeratio.dev/reference/symbol/IsPrimitiveClass),
  [`IsIndefinite`](https://enumeratio.dev/reference/symbol/IsIndefinite),
  [`IsQuadraticIrrational`](https://enumeratio.dev/reference/symbol/IsQuadraticIrrational),
  [`FormAutomorph`](https://enumeratio.dev/reference/symbol/FormAutomorph),
  [`FormRho`](https://enumeratio.dev/reference/symbol/FormRho)
- **Conjugacy and Rademacher** — [`ModularClass`](https://enumeratio.dev/reference/symbol/ModularClass),
  [`ModularClasses`](https://enumeratio.dev/reference/symbol/ModularClasses),
  [`RademacherSymbol`](https://enumeratio.dev/reference/symbol/RademacherSymbol),
  [`RademacherPhi`](https://enumeratio.dev/reference/symbol/RademacherPhi),
  [`DedekindSum`](https://enumeratio.dev/reference/symbol/DedekindSum),
  [`LinkingWithTrefoil`](https://enumeratio.dev/reference/symbol/LinkingWithTrefoil)
- **Number theory** — [`KroneckerSymbol`](https://enumeratio.dev/reference/symbol/KroneckerSymbol)

## Usage

```
ContinuedFraction(355/113)          // [3, 7, 16] — pi's famous convergent
SternBrocotPath(5, 3)               // "RLR"
RademacherSymbol("LRRRR")           // 3 — four rights, one left
DedekindSum(4, 3)                   // 1/18
RademacherPhi(ModularMatrix(1, 7, 0, 1))   // 7 — Phi on T^n just counts
```

## Next

[`@enumeratio/braid`](../braid/README.md) builds its [Lorenz braids](../braid/docs/lorenz.md)
directly on the S/T words here; the guide's linking-number payoff is the bridge between
the two packages.
