# @enumeratio/numerals

Numeral-system extensions for `@cortex-js/compute-engine`. compute-engine's `IntegerDigits`
and `FromDigits` already do fixed radix, so this package adds no head for that case — it
widens the **base slot** to accept a system value, the way Wolfram's
`IntegerDigits[n, MixedRadix[…]]` does: `FactorialNumerals`, `ZeckendorfNumerals`,
`BalancedNumerals(b)`, `NegativeNumerals(b)`, `BijectiveNumerals(k)`, `MixedRadixNumerals([…])`,
`PrimorialNumerals`, `CombinatorialNumerals(k)`, `ResidueNumerals([…])`,
`AdicNumerals(b, prec?)` and `PositionalNumerals(b)` are all just values passed where an
integer base would go. An integer base still goes to the native handler, unchanged. Builds on
`@enumeratio/residues` for the residue system and `gcd`.

`AdicNumeral` (singular) is a separate value head: the $b$-adic number itself, with its own
arithmetic (`Add`/`Multiply`/`Negate`/`Divide`/`Power` widened to carry it), infinite to the
left rather than the right.

The old one-word-per-flavour names (`Factoradic`, `Zeckendorf`, `BalancedRadix`, `Radix`, …)
still evaluate to their `…Numerals` spelling — see `NUMERAL_ALIASES`.

## Usage

```ts
import { declareNumerals } from "@enumeratio/numerals";
import { declareAdic } from "@enumeratio/numerals"; // AdicNumeral alone, without the systems

declareNumerals(ce); // declares AdicNumeral too
```

`./src` is exported for workspace packages needing the plain TypeScript.

```
IntegerDigits(42, AdicNumerals(10, 6))   // the 10-adic digits of 42, width 6
IntegerDigits(-3, BalancedNumerals(3))   // balanced ternary spells the sign in the digits
```

## Heads

**Numeral systems** (values for the base slot)

- [`Radix`](https://enumeratio.dev/reference/symbol/Radix) / [`PositionalNumerals`](https://enumeratio.dev/reference/symbol/PositionalNumerals) — ordinary base $b$, as a system value
- [`BalancedNumerals`](https://enumeratio.dev/reference/symbol/BalancedNumerals) / [`BalancedRadix`](https://enumeratio.dev/reference/symbol/BalancedRadix) — signless negatives, digits $-(b-1)/2 \ldots (b-1)/2$
- [`NegativeNumerals`](https://enumeratio.dev/reference/symbol/NegativeNumerals) / [`NegativeRadix`](https://enumeratio.dev/reference/symbol/NegativeRadix) — signless negatives over base $-b$
- [`BijectiveNumerals`](https://enumeratio.dev/reference/symbol/BijectiveNumerals) / [`BijectiveRadix`](https://enumeratio.dev/reference/symbol/BijectiveRadix) — digits $1\ldots k$, no zero (spreadsheet columns)
- [`FactorialNumerals`](https://enumeratio.dev/reference/symbol/FactorialNumerals) — place $k$ holds at most $k$ (the Lehmer code)
- [`PrimorialNumerals`](https://enumeratio.dev/reference/symbol/PrimorialNumerals) — factoradic with primes
- [`CombinatorialNumerals`](https://enumeratio.dev/reference/symbol/CombinatorialNumerals) / [`CombinatorialSystem`](https://enumeratio.dev/reference/symbol/CombinatorialSystem) — a strictly decreasing $k$-tuple (subset unranking)
- [`ResidueNumerals`](https://enumeratio.dev/reference/symbol/ResidueNumerals) / [`ResidueSystem`](https://enumeratio.dev/reference/symbol/ResidueSystem) — independent residues, no place values at all
- [`ZeckendorfNumerals`](https://enumeratio.dev/reference/symbol/ZeckendorfNumerals) — Fibonacci place values, no two adjacent ones
- [`OstrowskiNumerals`](https://enumeratio.dev/reference/symbol/OstrowskiNumerals) — digits over a continued fraction, generalises Zeckendorf
- [`AdicNumerals`](https://enumeratio.dev/reference/symbol/AdicNumerals) — fixed-width $b$-adic digits, negatives are all nines

**b-adic values**

- [`AdicNumeral`](https://enumeratio.dev/reference/symbol/AdicNumeral) — the $b$-adic value, exact or truncated to a precision
- [`AdicExpansion`](https://enumeratio.dev/reference/symbol/AdicExpansion) / [`AdicDigits`](https://enumeratio.dev/reference/symbol/AdicDigits) — its digit string
- [`AdicValuation`](https://enumeratio.dev/reference/symbol/AdicValuation) / [`AdicUnitPart`](https://enumeratio.dev/reference/symbol/AdicUnitPart) — the power of $b$ dividing it, and what's left after dividing it out
- [`AdicSqrt`](https://enumeratio.dev/reference/symbol/AdicSqrt) / [`HenselLift`](https://enumeratio.dev/reference/symbol/HenselLift) — square roots and Newton lifting in $\mathbb{Z}_b$

**Digits and strings**

- [`IntegerDigits`](https://enumeratio.dev/reference/symbol/IntegerDigits) / [`FromDigits`](https://enumeratio.dev/reference/symbol/FromDigits) — compute-engine's own heads, widened to take a system in the base slot
- [`RealDigits`](https://enumeratio.dev/reference/symbol/RealDigits) — digits of a rational, including the repeating part
- [`DigitCount`](https://enumeratio.dev/reference/symbol/DigitCount) / [`DigitSum`](https://enumeratio.dev/reference/symbol/DigitSum) / [`IntegerLength`](https://enumeratio.dev/reference/symbol/IntegerLength) / [`IntegerReverse`](https://enumeratio.dev/reference/symbol/IntegerReverse) — per-digit statistics and reversal
- [`IntegerString`](https://enumeratio.dev/reference/symbol/IntegerString) / [`RomanNumeral`](https://enumeratio.dev/reference/symbol/RomanNumeral) — string spellings
- [`NumberExpand`](https://enumeratio.dev/reference/symbol/NumberExpand) / [`NumeralSystemShape`](https://enumeratio.dev/reference/symbol/NumeralSystemShape) / [`Fraction`](https://enumeratio.dev/reference/symbol/Fraction) — expanding a number over a system, and describing a system's shape

## See also

See [Numeral systems](docs/numeral-systems.md) for why a numeral system is a bijection
between integers and digit strings, and a table of every system this package adds.
See [b-adic numbers](docs/adic.md) for how `AdicNumeral` and `AdicNumerals` relate, and where
they part ways off the non-negative integers.

Builds on `@enumeratio/residues` ([`residues`](../residues/README.md)) for `ResidueNumerals` and `gcd`.
`@enumeratio/number-theory` ([`number-theory`](../number-theory/README.md)) depends on this package.
