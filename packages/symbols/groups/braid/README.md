# @enumeratio/braid

Braid groups for compute-engine: the Artin presentation, positive braids and their
closures, the Burau representation, Alexander polynomials, torus knots, and the Lorenz
braids of modular geodesics. A braid word is a finite string of generator indices — a
complete combinatorial name for the knot its closure ties. Start with
[knots and braids](docs/knots-and-braids.md) for the group and the closure construction, then
[torus knots](docs/torus-knots.md) for the simplest infinite family, and
[the Lorenz flow](docs/lorenz.md) for the strange-attractor connection.

## Declaring

```ts
import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareBraid } from "@enumeratio/braid";

const ce = new ComputeEngine();
declareBraid(ce);
```

## Heads

- **The group** — [`Braid`](https://enumeratio.dev/reference/symbol/Braid),
  [`BraidProduct`](https://enumeratio.dev/reference/symbol/BraidProduct),
  [`BraidInverse`](https://enumeratio.dev/reference/symbol/BraidInverse),
  [`BraidPower`](https://enumeratio.dev/reference/symbol/BraidPower),
  [`BraidPermutation`](https://enumeratio.dev/reference/symbol/BraidPermutation),
  [`BraidStrands`](https://enumeratio.dev/reference/symbol/BraidStrands),
  [`BraidCrossings`](https://enumeratio.dev/reference/symbol/BraidCrossings),
  [`BraidIsPositive`](https://enumeratio.dev/reference/symbol/BraidIsPositive),
  [`BraidWrithe`](https://enumeratio.dev/reference/symbol/BraidWrithe)
- **Closure and invariants** — [`BraidIsKnot`](https://enumeratio.dev/reference/symbol/BraidIsKnot),
  [`BraidComponents`](https://enumeratio.dev/reference/symbol/BraidComponents),
  [`BurauMatrix`](https://enumeratio.dev/reference/symbol/BurauMatrix),
  [`AlexanderPolynomial`](https://enumeratio.dev/reference/symbol/AlexanderPolynomial),
  [`SeifertGenus`](https://enumeratio.dev/reference/symbol/SeifertGenus)
- **Jones/Kauffman** — [`KauffmanBracket`](https://enumeratio.dev/reference/symbol/KauffmanBracket),
  [`BracketInvariant`](https://enumeratio.dev/reference/symbol/BracketInvariant),
  [`JonesPolynomial`](https://enumeratio.dev/reference/symbol/JonesPolynomial)
- **Named knots** — [`TorusKnot`](https://enumeratio.dev/reference/symbol/TorusKnot),
  [`TorusBraid`](https://enumeratio.dev/reference/symbol/TorusBraid),
  [`FigureEightKnot`](https://enumeratio.dev/reference/symbol/FigureEightKnot),
  [`TwistKnot`](https://enumeratio.dev/reference/symbol/TwistKnot),
  [`PretzelKnot`](https://enumeratio.dev/reference/symbol/PretzelKnot)
- **Lorenz / modular geodesics** — [`LorenzBraid`](https://enumeratio.dev/reference/symbol/LorenzBraid),
  [`LorenzPermutation`](https://enumeratio.dev/reference/symbol/LorenzPermutation),
  [`PositivePermutationBraid`](https://enumeratio.dev/reference/symbol/PositivePermutationBraid),
  [`TripNumber`](https://enumeratio.dev/reference/symbol/TripNumber)
- **Curves** — [`KnotCurve`](https://enumeratio.dev/reference/symbol/KnotCurve),
  [`LorenzCurve`](https://enumeratio.dev/reference/symbol/LorenzCurve),
  [`ParametricCurve`](https://enumeratio.dev/reference/symbol/ParametricCurve)

## Usage

```
JonesPolynomial(Braid(2, [1, 1, 1]))   // the right-handed trefoil's polynomial
AlexanderPolynomial(Braid(2, [1, 1, 1]))   // t^2 - t + 1 — same trefoil
AlexanderPolynomial("LLRLR")   // t^2 - t + 1 — the shortest knotted modular geodesic
TripNumber("LLRLR")   // 2 — its braid index
```

A modular geodesic word (`L`/`R`) and a braid closure can name the same knot; the Lorenz
guide is where that correspondence comes from — see also
[`@enumeratio/modular`](../modular/README.md), whose S/T words feed the Lorenz braid construction.

## Next

`src/laurent.ts` carries the Laurent-polynomial arithmetic the Alexander and Jones
computations run on; `src/curve.ts` is the parametric-curve sampling behind the
guides' 3D plots.
