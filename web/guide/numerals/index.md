# Numeral Systems

A number and its digits are different things. `IntegerDigits(10, 2)` is `[1,0,1,0]`, but
the ten did not change — only the spelling. A
[numeral system](https://en.wikipedia.org/wiki/Numeral_system) is a **bijection between
integers and digit strings**, and once you say it that way it is clear that base-b is
one member of a much larger family.

compute-engine already has `IntegerDigits` and `FromDigits`, and they already do fixed
radix. `@enumeratio/numerals` adds no head for that — it **widens the base slot to take
a system**, the way Wolfram's `IntegerDigits[n, MixedRadix[…]]` does. An integer base
still goes to the native handler, unchanged.

## One slot, many systems

| System                     | Digits                           | Notes                           |
| -------------------------- | -------------------------------- | ------------------------------- |
| `2`, `16`, …               | 0…b−1                            | compute-engine's own, untouched |
| `MixedRadixNumerals([…])`  | a different bound per place      | days/hours/minutes/seconds      |
| `FactorialNumerals`        | place k holds at most k          | the Lehmer code                 |
| `PrimorialNumerals`        | place k below the (k+1)-th prime | factoradic with primes          |
| `BalancedNumerals(b)`      | −(b−1)/2 … (b−1)/2               | **signless negatives**          |
| `NegativeNumerals(b)`      | 0…b−1 over (−b)^k                | **signless negatives**          |
| `BijectiveNumerals(k)`     | 1…k, no zero digit               | spreadsheet columns             |
| `ZeckendorfNumerals`       | binary over Fibonacci places     | **no two adjacent ones**        |
| `CombinatorialNumerals(k)` | a strictly decreasing k-tuple    | k-subset unranking              |
| `ResidueNumerals([…])`     | independent residues             | **no place values at all**      |
| `OstrowskiNumerals([…])`   | digits over a continued fraction | **generalises Zeckendorf**      |
| `AdicNumerals(b, prec?)`   | base b, infinite to the LEFT     | **negatives are all nines**     |

The old names (`Factoradic`, `PrimorialRadix`, `BalancedRadix`, `NegativeRadix`,
`BijectiveRadix`, `Zeckendorf`, `Ostrowski`, `CombinatorialSystem`, `ResidueSystem`,
`MixedRadix`) still work — each evaluates to its `…Numerals` spelling above.

Four of those are not "base-b with a twist": Zeckendorf and Ostrowski constrain digits by
a _forbidden pattern_ instead of a per-place bound, the residue system has _no place
values_, and two of them represent negative integers with _no sign_. The last one is
base b read in the other direction — digits that stop on the right and never on the
left — and it comes with a value type and arithmetic of its own:
[b-adic numbers](./adic).

<Story title="The base slot is a system">
<template #description>93 784 seconds is 1 day, 2 hours, 3 minutes, 4 seconds.</template>
<notatio-cell value="IntegerDigits(93784, MixedRadixNumerals([24, 60, 60]))" />
<notatio-cell value="FromDigits([1, 2, 3, 4], MixedRadixNumerals([24, 60, 60]))" />
<notatio-cell value="IntegerDigits(255, 16)" />
</Story>

## Two of these systems are unranking maps in disguise

This is the part that earns numeral systems a place next to the collections.

**Factoradic digits are the Lehmer code.** Writing n in the system whose place values
are the factorials, and unranking the n-th permutation in lexicographic order, are the
_same computation_. Pad to one digit per position and the two line up exactly:

<Story title="Factoradic = Lehmer code">
<template #description>The padded factoradic digits of 5, and the 6th permutation of four things. The code says: take item 0, then item 2 of what is left, then item 1, then the last.</template>
<notatio-cell value="IntegerDigits(5, FactorialNumerals, 4)" />
<notatio-cell value="SymmetricGroup(4)[6]" />
</Story>

**The combinatorial number system is k-subset unranking.** Its digits _are_ the subset:
n = C(c_k,k) + … + C(c_1,1), and the c's — shifted from 0-based to 1-based — are exactly
the n-th k-subset in colexicographic order.

<Story title="Combinatorial system = KSubsets">
<template #description>Digits [3,2,1] are the 0-based subset; add one to each and you get {2,3,4}, which is the 4th 3-subset.</template>
<notatio-cell value="IntegerDigits(3, CombinatorialNumerals(3))" />
<notatio-cell value="KSubsets(5, 3)[4]" />
</Story>

So "write this number in that system" and "give me the n-th object of that kind" are one
question asked twice. A mixed-radix numeral _is_ a lexicographic rank.

## Negatives without a sign

Balanced ternary and negabinary both represent every integer — negative ones included —
with no sign and no two's-complement convention. In balanced ternary, **negating a
number is negating each digit**.

<Story title="Signless">
<template #description>5 is 9−3−1, and −5 is its digit-wise negation. Compare the last cell: fixed radix has to drop the sign.</template>
<notatio-cell value="IntegerDigits(5, BalancedNumerals(3))" />
<notatio-cell value="IntegerDigits(-5, BalancedNumerals(3))" />
<notatio-cell value="IntegerDigits(3, NegativeNumerals(2))" />
<notatio-cell value="IntegerDigits(-5, 2)" />
</Story>

## A forbidden pattern instead of a bound

Zeckendorf's theorem: every positive integer is a sum of non-consecutive Fibonacci
numbers, in exactly one way — and greedy finds it. So the digits are binary, but what
makes a string a _numeral_ is that **no two ones are adjacent**, not a per-place range.
A string with two adjacent ones denotes nothing, and `FromDigits` says so by declining.

<Story title="Zeckendorf">
<template #description>100 = 89 + 8 + 3. The last cell is not a numeral, so it is left standing.</template>
<notatio-cell value="IntegerDigits(100, ZeckendorfNumerals)" />
<notatio-cell value="FromDigits([1, 0, 0, 0, 0, 1, 0, 1, 0, 0], ZeckendorfNumerals)" />
<notatio-cell value="FromDigits([1, 1], ZeckendorfNumerals)" />
</Story>

## Zeckendorf is one continued fraction's worth

Ostrowski numeration is the general form. Take any irrational α with continued fraction
$[a_0; a_1, a_2, \ldots]$; the denominators of its convergents satisfy
$q_k = a_k q_{k-1} + q_{k-2}$, and those are the place values. Every integer in range then
has exactly one representation

$$N \;=\; b_1 q_0 + b_2 q_1 + \cdots + b_m q_{m-1},$$

subject to $0 \le b_1 < a_1$, $0 \le b_k \le a_k$, and — the rule that does the real work —
$b_{k-1} = 0$ whenever $b_k$ reaches its ceiling $a_k$.

That last condition is what forbids a carry, and it is the general shape of "no two
adjacent ones". Feed it the all-ones continued fraction, which is
$\varphi = [1; 1, 1, 1, \ldots]$, and the $q_k$ are the Fibonacci numbers and the ceiling
rule collapses to Zeckendorf's. So **Zeckendorf is the $\alpha = \varphi$ case** — and the
package checks the two against each other rather than taking that on trust.

<Story title="A continued fraction as a numeral system">
<template #description>All quotients 1 is φ, and the digits are Zeckendorf's with one extra forced zero.</template>
<notatio-cell value="IntegerDigits(20, OstrowskiNumerals([1, 1, 1, 1, 1, 1, 1, 1]))" />
<notatio-cell value="IntegerDigits(20, ZeckendorfNumerals)" />
<notatio-cell value="IntegerDigits(9, OstrowskiNumerals([2, 2, 2]))" />
<notatio-cell value="FromDigits([1, 2, 1], OstrowskiNumerals([2, 2, 2]))" />
</Story>

The last cell declines: the middle digit is already at its ceiling, so nothing below it
may be non-zero. Which continued fraction you pick changes the arithmetic completely —
this is the same $[a_0; a_1, \ldots]$ that names elements of
[the modular group](/guide/modular/), wearing a different hat.

## No place values at all

A residue number system writes n as its remainders against a list of moduli. There are
no place values and no order — the digits are **independent**, which is exactly why
addition and multiplication are carry-free and can be done in parallel, one channel at
a time. By CRT it is a bijection onto [0, ∏mᵢ) precisely when the moduli are pairwise
coprime; otherwise it is not a numeral system at all, and a digit string can be
inconsistent.

<Story title="Carry-free arithmetic">
<template #description>23 + 41 = 64, done channel by channel: (2+2, 3+1, 2+6) reduced is (1,4,1), which reads back as 64 — no carries between channels.</template>
<notatio-cell value="IntegerDigits(23, ResidueNumerals([3, 5, 7]))" />
<notatio-cell value="IntegerDigits(41, ResidueNumerals([3, 5, 7]))" />
<notatio-cell value="FromDigits([1, 4, 1], ResidueNumerals([3, 5, 7]))" />
<notatio-cell value="NumeralSystemShape(ResidueNumerals([4, 6]))" />
</Story>

These are the same CRT channels the [hypercomplex
page](/guide/hypercomplex/finite) uses to find split units: a residue numeral and a
spectral sign vector are the same object, read for different purposes.

Each digit is a residue class — an [`IntegerMod`](/reference/symbol/IntegerMod), an element of
ℤ/mᵢ that arithmetic stays inside — and reading the numeral back is the Chinese remainder
theorem applied to those classes.

<Story title="Digits are residue classes">
<template #description>The channels of 23 as elements of ℤ/3, ℤ/5 and ℤ/7; ChineseRemainder of the classes is 23 again, as a class mod 105.</template>
<notatio-cell value="IntegerMod(23, 3) * IntegerMod(41, 3)" />
<notatio-cell value="ChineseRemainder(IntegerMod(2, 3), IntegerMod(3, 5), IntegerMod(2, 7))" />
</Story>

## Bijective base 26 is spreadsheet columns

Digits 1…26 with no zero DIGIT — but zero itself is the empty numeral, which is what makes
the correspondence a bijection: one string over $\{1..26\}$ per non-negative integer, and
the empty one is left for zero. So every positive integer has exactly one spelling and there
are no leading-zero ambiguities. Map 1…26 to A…Z and you get the column lettering: 26 is
Z, 27 is AA, 702 is ZZ, 703 is AAA. Note that there is **no numeral for zero** at all.

<Story title="A, …, Z, AA, …">
<notatio-cell value="IntegerDigits(26, BijectiveNumerals(26))" />
<notatio-cell value="IntegerDigits(27, BijectiveNumerals(26))" />
<notatio-cell value="IntegerDigits(703, BijectiveNumerals(26))" />
<notatio-cell value="IntegerDigits(0, BijectiveNumerals(26))" />
</Story>

## Things worth knowing

**The round trip is the specification.** A numeral system is a bijection, so the only
property worth testing is that `FromDigits(IntegerDigits(n, S), S)` is n — and that is
what the tests do, for every system, over a range, rather than pinning spot values. Each
system's digit _shape_ is then characterised separately and independently: factoradic
digits satisfy d_k ≤ k, Zeckendorf digits have no adjacent ones, balanced digits are
bounded by ±(b−1)/2, bijective digits avoid zero.

**Declining is an answer.** An integer with no numeral in a system (zero in bijective
base, anything past ∏mᵢ in a residue system) and a digit string that denotes no integer
(adjacent Zeckendorf ones, an out-of-range mixed-radix digit, inconsistent residues) both
leave the call standing rather than returning something false.

**Nothing native changed.** `IntegerDigits(n, b)` for an integer b is still
compute-engine's own handler, and a test pins that against a bare engine.

**Not built yet.** Non-integer bases — golden-ratio base φ is the interesting one, where
the digit string of an integer is _infinite to the right_ unless you allow a fractional
part. Also no digit _rendering_: `BaseForm` exists natively and could learn these
systems, and bijective base 26 obviously wants to print as letters rather than as a list
of numbers.
