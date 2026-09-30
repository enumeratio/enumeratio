# @enumeratio/residues

Modular arithmetic for `@cortex-js/compute-engine`, over bigints: residues, CRT, factoring,
every r-th root of a residue, discrete logarithms and primitive roots, plus `IntegerMod` — an
element of $\mathbb{Z}/m$ as a value, after Sage's `Mod(a, m)`. Every head answers exactly or
stays unevaluated — no such residue, an unfactorable modulus, more roots than it will list —
never approximate.

Primality is Baillie–PSW; factoring is trial division then Pollard's rho, budgeted
(`RHO_BUDGET`) so a hard semiprime declines rather than hangs. `NthPrime`/`PrimePi` sieve below
`PRIME_SIEVE_LIMIT` and switch to Lucy_Hedgehog counting up to `PRIME_PI_LIMIT`.

## Usage

```ts
import { declareResidues } from "@enumeratio/residues";

declareResidues(ce);
```

`./src` is exported for workspace packages that need the plain TypeScript (test setups,
sibling packages in this monorepo). The plain kernels (`gcd`, `powMod`, `crt`, `factorInteger`,
`isPrime`, …) are also exported directly for use outside an engine.

```
PowerModList(3, 1/2, 11)   // [5, 6] — the square roots of 3 mod 11
FactorInteger(360)         // [[2, 3], [3, 2], [5, 1]]
```

## Heads

**Modular arithmetic**

- [`ChineseRemainder`](https://enumeratio.dev/reference/symbol/ChineseRemainder) — CRT, also over [`IntegerMod`](https://enumeratio.dev/reference/symbol/IntegerMod) classes
- [`IntegerMod`](https://enumeratio.dev/reference/symbol/IntegerMod) / [`IntegerModRing`](https://enumeratio.dev/reference/symbol/IntegerModRing) — an element of $\mathbb{Z}/m$, and the ring itself, as values; `Add`/`Multiply`/`Negate`/`Divide`/`Power` are widened to carry them
- [`PowerMod`](https://enumeratio.dev/reference/symbol/PowerMod) — modular exponentiation, widened to a rational exponent `s/r` (the least r-th root) and a rational base
- [`PowerModList`](https://enumeratio.dev/reference/symbol/PowerModList) — every r-th root of $a^s$ mod $m$
- [`MultiplicativeOrder`](https://enumeratio.dev/reference/symbol/MultiplicativeOrder) — the order of $a$ mod $n$, widened to a discrete log against a target list
- [`PrimitiveRootList`](https://enumeratio.dev/reference/symbol/PrimitiveRootList) — the primitive roots of a cyclic $(\mathbb{Z}/n)^\times$

Also declared without a reference page yet: `discreteLog`, `primitiveRoots`,
`primitiveRootCount`, `unitsMod`, and `rootsInCyclicGroup` (baby-step giant-step over a generic
cyclic group).

## See also

`@enumeratio/numerals` ([`numerals`](../numerals/README.md)) sits on top of this package for numeral
systems, including a residue-numeral system built from `ChineseRemainder`. `@enumeratio/number-theory`
([`number-theory`](../number-theory/README.md)) extends `PowerMod`/`PowerModList` to the Gaussian integers.
