# @enumeratio/adeles

Adèles and idèles over $\mathbb{Q}$ for compute-engine — a port of Mathé Hertogh's Sage
`adeles` package. Three value heads (`ProfiniteNumber`, `Adele`, `Idele`) carry a number
known only modulo something, and existing heads (arithmetic, `Equal`, `Numerator`,
`Fibonacci`, `LucasL`) learn to take them rather than growing new ones.

## Usage

```ts
import { declareAdeles } from "@enumeratio/adeles";

declareAdeles(ce);
```

```
ProfiniteNumber(3, 12) + ProfiniteNumber(5, 8)   // ProfiniteNumber(0, 4)
Equal(ProfiniteNumber(6, 20), ProfiniteNumber(6, 40))   // True
Numerator(ProfiniteNumber(Rational(2, 3), 5))   // ProfiniteNumber(2, 15)
```

`./src` exports the raw TypeScript entry for a workspace consumer; `profinite` and
`idele` are re-exported as namespaces over the plain-value arithmetic (`Profinite`,
`IdeleFinite`) that the heads box and unbox. `determinant`, `inverse` and
`profiniteDecomposition` (from `matrix.ts`) implement strong approximation for
$GL_n(\hat{\mathbb{Q}})$ and back `ProfiniteDecomposition`.

## Heads

**Values.** [`ProfiniteNumber`](https://enumeratio.dev/reference/symbol/ProfiniteNumber)
is the coset $x + m\hat{\mathbb{Z}}$; modulus 0 is exact. `ProfiniteNumber(list)` glues a
list of `AdicNumeral` values back together by CRT.
[`Adele`](https://enumeratio.dev/reference/symbol/Adele) pairs a real with a profinite
number; [`Idele`](https://enumeratio.dev/reference/symbol/Idele) is a unit of the adèle
ring, principal everywhere except a named finite set of primes.

**Matrices.** [`ProfiniteDecomposition`](https://enumeratio.dev/reference/symbol/ProfiniteDecomposition)
factors $m \in GL_n(\hat{\mathbb{Q}})$ as $b \cdot a$ with $b \in GL_n(\hat{\mathbb{Z}})$
and $a \in GL_n^+(\mathbb{Q})$ upper triangular.

**Visualization.** [`ProfinitePlot`](https://enumeratio.dev/reference/symbol/ProfinitePlot)
draws a profinite function $\hat{\mathbb{Z}} \to \hat{\mathbb{Z}}$ as an `ArrayPlot`,
residue classes laid out by factorial digits.

## See also

See [Adèles and idèles](docs/adeles-and-ideles.md) for the worked walkthrough — cosets,
equality as "the sets meet", one prime at a time, and profinite Fibonacci.

Builds on [`@enumeratio/number-theory`](../number-theory/README.md) (Hermite normal form, for the matrix
decomposition), [`@enumeratio/numerals`](../numerals/README.md) (`AdicNumeral`, the p-adic values a profinite
number's list form glues together), and [`@enumeratio/residues`](../residues/README.md) (CRT, modular inverse).
