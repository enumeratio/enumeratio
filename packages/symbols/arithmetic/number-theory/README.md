# @enumeratio/number-theory

Number theory past $\mathbb{Z}/m$ for `@cortex-js/compute-engine`, over bigints: Gaussian
integers, rational reconstruction, Hermite normal form and integer valuations, plus a sweep
of Wolfram heads compute-engine doesn't have (divisor sums, Jacobi/Kronecker/Legendre
symbols, Stirling and Bell numbers, Frobenius, …). Builds on `@enumeratio/residues` (declare
that first) and `@enumeratio/numerals`. Every head answers exactly or stays unevaluated —
never approximate.

A handful of compute-engine's own heads (`Fibonacci`, `LucasL`, `Factorial`, `GCD`,
`NthPrime`, `PrimePi`) are re-declared here with faster exact algorithms — fast doubling,
binary splitting, Lehmer's algorithm, a segmented sieve — for the same results; see the
`declare-fast-*` modules.

## Usage

```ts
import { declareNumberTheory } from "@enumeratio/number-theory";

declareNumberTheory(ce); // declares @enumeratio/residues first if not already declared
```

`./src` exports the raw TypeScript entry for a workspace consumer. `gaussian` is a namespace
over the plain Gaussian-integer arithmetic the heads box and unbox; `hermiteDecomposition`,
`rationalReconstruction`, `fibonacci`/`fibonacciMod`/`lucasL`/`lucasLMod` are also exported
directly.

```
FactorInteger(360)                          // [[2, 3], [3, 2], [5, 1]]
HermiteDecomposition([[1, 2], [3, 4]])      // the unimodular u and Hermite form h with u·m = h
```

## Heads

**Primes and factoring**

- [`FactorInteger`](https://enumeratio.dev/reference/symbol/FactorInteger) / [`Divisors`](https://enumeratio.dev/reference/symbol/Divisors) — prime factorization and the divisor list
- [`IsPrime`](https://enumeratio.dev/reference/symbol/IsPrime) / [`IsPrimePower`](https://enumeratio.dev/reference/symbol/IsPrimePower) / [`IsSquareFree`](https://enumeratio.dev/reference/symbol/IsSquareFree)
- [`NextPrime`](https://enumeratio.dev/reference/symbol/NextPrime) / [`NthPrime`](https://enumeratio.dev/reference/symbol/NthPrime) / [`PrimePi`](https://enumeratio.dev/reference/symbol/PrimePi)

**Divisor and multiplicative functions**

- [`DivisorSigma`](https://enumeratio.dev/reference/symbol/DivisorSigma) / [`DivisorSum`](https://enumeratio.dev/reference/symbol/DivisorSum) / [`Totient`](https://enumeratio.dev/reference/symbol/Totient) / [`CarmichaelLambda`](https://enumeratio.dev/reference/symbol/CarmichaelLambda)
- [`MoebiusMu`](https://enumeratio.dev/reference/symbol/MoebiusMu) / [`MangoldtLambda`](https://enumeratio.dev/reference/symbol/MangoldtLambda) / [`LiouvilleLambda`](https://enumeratio.dev/reference/symbol/LiouvilleLambda)
- [`PrimeNu`](https://enumeratio.dev/reference/symbol/PrimeNu) / [`PrimeOmega`](https://enumeratio.dev/reference/symbol/PrimeOmega) — distinct and with-multiplicity prime counts
- [`IsPerfect`](https://enumeratio.dev/reference/symbol/IsPerfect) / [`PerfectNumber`](https://enumeratio.dev/reference/symbol/PerfectNumber) / [`MersennePrimeExponent`](https://enumeratio.dev/reference/symbol/MersennePrimeExponent)

**GCD, modular and symbols**

- [`GCD`](https://enumeratio.dev/reference/symbol/GCD) / [`LCM`](https://enumeratio.dev/reference/symbol/LCM) / [`ExtendedGCD`](https://enumeratio.dev/reference/symbol/ExtendedGCD) / [`IsCoprime`](https://enumeratio.dev/reference/symbol/IsCoprime)
- [`ModularInverse`](https://enumeratio.dev/reference/symbol/ModularInverse) / [`IntegerExponent`](https://enumeratio.dev/reference/symbol/IntegerExponent) / [`Quotient`](https://enumeratio.dev/reference/symbol/Quotient)
- [`JacobiSymbol`](https://enumeratio.dev/reference/symbol/JacobiSymbol) / [`KroneckerSymbol`](https://enumeratio.dev/reference/symbol/KroneckerSymbol) / [`LegendreSymbol`](https://enumeratio.dev/reference/symbol/LegendreSymbol)

**Sequences and combinatorial number theory**

- [`Fibonacci`](https://enumeratio.dev/reference/symbol/Fibonacci) / [`LucasL`](https://enumeratio.dev/reference/symbol/LucasL) — fast doubling, and continuous on the profinite integers `@enumeratio/adeles` adds
- [`BellNumber`](https://enumeratio.dev/reference/symbol/BellNumber) / [`CatalanNumber`](https://enumeratio.dev/reference/symbol/CatalanNumber) / [`Stirling`](https://enumeratio.dev/reference/symbol/Stirling) / [`StirlingS1`](https://enumeratio.dev/reference/symbol/StirlingS1) / [`Multinomial`](https://enumeratio.dev/reference/symbol/Multinomial) / [`Subfactorial`](https://enumeratio.dev/reference/symbol/Subfactorial)
- [`PartitionsQ`](https://enumeratio.dev/reference/symbol/PartitionsQ) / [`SquaresR`](https://enumeratio.dev/reference/symbol/SquaresR) / [`PowersRepresentations`](https://enumeratio.dev/reference/symbol/PowersRepresentations) / [`RamanujanTau`](https://enumeratio.dev/reference/symbol/RamanujanTau)
- [`FrobeniusNumber`](https://enumeratio.dev/reference/symbol/FrobeniusNumber) / [`FrobeniusSolve`](https://enumeratio.dev/reference/symbol/FrobeniusSolve) — the largest non-representable value, and every representation, for a coin-problem instance
- [`EulerE`](https://enumeratio.dev/reference/symbol/EulerE) at an integer index

**Past the integers**

- [`GaussianIntegers`](https://enumeratio.dev/reference/symbol/GaussianIntegers) — $\mathbb{Z}[i]$; `PowerMod`, `PowerModList`, `GCD`, `LCM`, `IntegerExponent` and `Divisors` all reach into it when an operand is genuinely complex
- [`RationalReconstruction`](https://enumeratio.dev/reference/symbol/RationalReconstruction) — the rational nearest a residue mod $m$
- [`HermiteDecomposition`](https://enumeratio.dev/reference/symbol/HermiteDecomposition) — unimodular $u$ with $um$ in Hermite normal form; backs `@enumeratio/adeles`' strong approximation

## See also

Builds on `@enumeratio/residues` ([`residues`](../residues/README.md)) and `@enumeratio/numerals`
([`numerals`](../numerals/README.md)). `@enumeratio/adeles` ([`adeles`](../adeles/README.md)) depends on this
package for `HermiteDecomposition` and extends `Fibonacci`/`LucasL` to the profinite
integers.
