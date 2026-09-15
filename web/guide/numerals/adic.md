# b-adic Numbers

Positional notation writes a number as digits that stop on the left and may run forever
on the right: $1/3 = 0.333\ldots$. Turn that around — digits that stop on the **right**
and run forever on the **left** — and the same long division gives
$1/3 = \ldots 6667$, because $\ldots 6667 \times 3 = \ldots 0001$. Those are the
[$b$-adic numbers](https://en.wikipedia.org/wiki/P-adic_number): the completion of the
rationals under the rule that _divisible by a high power of $b$ means small_.

`AdicNumeral(b, x)` is the value; `AdicNumerals(b)` is the matching numeral system in the
base slot of `IntegerDigits`. On the non-negative integers the two directions agree
digit for digit. Everywhere else they part ways, and this page is a tour of where.

## The same digits, the other way round

<Story title="ℕ: nothing changes">
<template #description>The 10-adic digits of 42 are the decimal digits of 42, padded to the cut: the expansion has no left end, so the width is part of the numeral. The residue system with moduli 16 and 625 reads the same last four digits mod each.</template>
<notatio-cell value="IntegerDigits(42, 10)" />
<notatio-cell value="IntegerDigits(42, AdicNumerals(10, 6))" />
<notatio-cell value="AdicExpansion(AdicNumeral(10, 42))" />
<notatio-cell value="IntegerDigits(42, ResidueSystem([16, 625]))" />
</Story>

## Negatives: a sign, or infinitely many nines

Fixed radix drops the sign. Balanced ternary spells it with negative digits. The
$b$-adics spell it with **digits alone, infinitely many of them**: $-1 = \ldots 9999$,
because adding 1 carries forever and leaves zero. A residue system wraps instead —
$-3$ mod 7 is 4 — which is the same idea cut at each modulus.

<Story title="−3, four ways">
<template #description>Positional, balanced, adic, residue. The adic string is the one that makes −3 + 3 = 0 by ordinary column addition.</template>
<notatio-cell value="IntegerDigits(-3, 10)" />
<notatio-cell value="IntegerDigits(-3, BalancedRadix(3))" />
<notatio-cell value="AdicExpansion(AdicNumeral(10, -3), 8)" />
<notatio-cell value="IntegerDigits(-3, AdicNumerals(10, 8))" />
<notatio-cell value="FromDigits([9, 9, 9, 9, 9, 9, 9, 7], AdicNumerals(10))" />
<notatio-cell value="IntegerDigits(-3 % 77, ResidueSystem([7, 11]))" />
</Story>

`FromDigits` with `AdicNumerals` reads a digit string back as the residue **nearest
zero**, which is what makes the negatives round-trip: eight nines and a seven is $-3$,
not $99\,999\,997$. The width does the work — `[7]` alone reads as $-3$ too. That is the
price of a system with no left end: a numeral is a string _of a given width_, exactly as
in two's complement.

<Story title="Adding −1 and 1">
<template #description>The arithmetic is the ordinary ring arithmetic; the printed form is what a column addition of …999 and 1 leaves behind.</template>
<notatio-cell value="AdicNumeral(10, -1) + 1" />
<notatio-cell value="AdicExpansion(AdicNumeral(10, -1), 6)" />
<notatio-cell value="AdicExpansion(AdicNumeral(2, -1), 8)" />
</Story>

## Rationals: to the right, to the left, or in every channel at once

$1/3$ has no finite decimal — the digits recur to the right. It has no finite $10$-adic
expansion either — the digits recur to the **left** — but as a $10$-adic _integer_ it is a
perfectly good element: $\ldots 6667$, and multiplying by 3 gives 1. A residue system
gets there a third way: $1/3$ is whatever multiplies 3 to give 1 in **each channel
independently**, which is the modular inverse.

<Story title="1/3">
<template #description>Left: 10-adic, and its check. Right: the residue system's answer is 26, because 26 × 3 = 78 ≡ 1 mod 77 — and 26 is exactly what the last two adic digits give mod 100: 67 × 3 = 201.</template>
<notatio-cell value="AdicExpansion(AdicNumeral(10, 1 / 3), 8)" />
<notatio-cell value="AdicNumeral(10, 1 / 3) * 3" />
<notatio-cell value="IntegerDigits(PowerMod(3, -1, 77), ResidueSystem([7, 11]))" />
<notatio-cell value="FromDigits([5, 4], ResidueSystem([7, 11]))" />
<notatio-cell value="67 * 3 % 100" />
</Story>

The base decides which rationals are integers. In $\mathbb{Z}_{10}$, $1/3$ is an integer
and $1/2$ is not — there is no $10$-adic digit string that 2 multiplies to $\ldots 0001$,
since $2 \times$ anything ends in an even digit. Same in $\mathbb{Z}_2$: $1/3$ is the
alternating $\ldots 10101011$, and $1/2$ has no expansion at all.

<Story title="Which rationals are integers">
<template #description>1/3 in ℤ₂ and ℤ₁₀; 1/2 declines in both. The last cell is 1/3 in ℤ₇ — every base coprime to 3 has one.</template>
<notatio-cell value="AdicExpansion(AdicNumeral(2, 1 / 3), 8)" />
<notatio-cell value="AdicNumeral(10, 1 / 2)" />
<notatio-cell value="AdicNumeral(2, 1 / 2)" />
<notatio-cell value="AdicExpansion(AdicNumeral(7, 1 / 3), 8)" />
</Story>

## Prime bases are fields; composite bases have zero divisors

For a prime $p$ the story completes: $\mathbb{Q}_p$ is a field, and dividing by $p$ just
moves the point. $7/25$ in $\mathbb{Q}_5$ is $0.12$ — two digits **past** the point,
because $7/25 = 2 \cdot 5^{-2} + 1 \cdot 5^{-1}$. The **valuation** counts those places:
$v_5(75) = 2$, $v_5(3/25) = -2$. The norm $|x|_p = p^{-v}$ is the distance: $75$ is
_small_ $5$-adically, at $1/25$ from zero.

<Story title="ℚ₅">
<template #description>A point in the numeral, and the valuation that says where it goes.</template>
<notatio-cell value="AdicExpansion(AdicNumeral(5, 7 / 25), 8)" />
<notatio-cell value="AdicNumeral(5, 3) / 5" />
<notatio-cell value="AdicValuation(AdicNumeral(5, 75))" />
<notatio-cell value="AdicNorm(AdicNumeral(5, 75))" />
<notatio-cell value="AdicUnitPart(AdicNumeral(5, 75))" />
</Story>

A composite base gives a ring instead, and a strange one. $\mathbb{Z}_{10}$ contains two
numbers $e, f$ with $e^2 = e$, $f^2 = f$, $e + f = 1$, and $e \cdot f = 0$ — neither of
them is $0$ or $1$. They come from Hensel lifting $x^2 = x$ from its roots $5$ and $6$
mod $10$, and they are the reason $\mathbb{Z}_{10} \cong \mathbb{Z}_2 \times \mathbb{Z}_5$:
one idempotent is $(0, 1)$ and the other $(1, 0)$. This is the residue system's
"independent channels" again, at infinite precision. A residue system with moduli
$2^k, 5^k$ is the $10$-adic truncation with its two factors pulled apart.

<Story title="Zero divisors in ℤ₁₀">
<template #description>…890625 and …109376: each is its own square, they sum to 1, and their product is 0. No prime base has anything like them.</template>
<notatio-cell value="AdicExpansion(HenselLift(x ^ 2 - x, 5, 10, 8))" />
<notatio-cell value="AdicExpansion(HenselLift(x ^ 2 - x, 6, 10, 8))" />
<notatio-cell value="HenselLift(x ^ 2 - x, 5, 10, 8) * HenselLift(x ^ 2 - x, 6, 10, 8)" />
<notatio-cell value="HenselLift(x ^ 2 - x, 5, 10, 8) + HenselLift(x ^ 2 - x, 6, 10, 8)" />
<notatio-cell value="IntegerDigits(12890625, ResidueSystem([256, 390625]))" />
</Story>

## Roots that exist nowhere else

Hensel's lemma is Newton's method run in $\mathbb{Z}_p$: a simple root mod $p$ lifts to a
root mod every $p^k$, doubling its correct digits each step. So $\sqrt{2}$ exists in
$\mathbb{Z}_7$ (since $3^2 = 9 \equiv 2$), $\sqrt{-7}$ exists in $\mathbb{Z}_2$ (since
$-7 \equiv 1 \pmod 8$), and $\sqrt{3}$ does not exist in $\mathbb{Z}_7$ at all. These
values are known only to a precision, and print with their `O`-term; arithmetic with them
carries the precision along.

<Story title="Hensel">
<template #description>A square root of 2 in ℤ₇ to six digits, squared back; the same root by HenselLift; −7's root in ℤ₂; and 3's absence in ℤ₇.</template>
<notatio-cell value="AdicSqrt(AdicNumeral(7, 2), 6)" />
<notatio-cell value="AdicSqrt(AdicNumeral(7, 2), 6) ^ 2" />
<notatio-cell value="HenselLift(x ^ 2 - 2, 3, 7, 6)" />
<notatio-cell value="AdicExpansion(AdicSqrt(AdicNumeral(2, -7), 10))" />
<notatio-cell value="AdicSqrt(AdicNumeral(7, 3))" />
</Story>

## Where they align and where they differ

| on…                             | positional base $b$          | residue system $[m_1, \ldots]$                 | $b$-adic                                                                     |
| ------------------------------- | ---------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------- |
| $n \ge 0$                       | digits of $n$                | $n \bmod m_i$, each channel                    | **the same digits**, padded to the cut                                       |
| $n < 0$                         | a sign                       | wraps: $n \bmod m_i$                           | infinitely many leading $b-1$: $-1 = \ldots 999$                             |
| $1/3$                           | recurs to the right          | $3^{-1} \bmod m_i$, if it exists               | recurs to the left: $\ldots 6667$; an **integer**                            |
| $1/2$ in base 10                | $0.5$                        | $2^{-1} \bmod m_i$, if $m_i$ odd               | **does not exist** in $\mathbb{Z}_{10}$                                      |
| $1/25$ in base 5                | $0.04$                       | needs $\gcd(25, m_i) = 1$                      | $0.01$: digits past the point, $\mathbb{Q}_5$                                |
| $\sqrt{2}$ in base 7            | irrational, no finite string | a residue mod each $m_i$, no coherence         | a genuine element of $\mathbb{Z}_7$, by Hensel                               |
| $e^2 = e$, $e \ne 0, 1$         | none                         | $(1, 0)$ and $(0, 1)$ across channels          | $\ldots 890625$ and $\ldots 109376$ in $\mathbb{Z}_{10}$; none for prime $b$ |
| "close to zero"                 | small absolute value         | —                                              | divisible by a high power of $b$                                             |
| moduli $p_i^{k}$, $\prod = b^k$ | —                            | **is** the $b$-adic truncation, split by prime | reads back mod each $p_i^k$                                                  |

The last row is the one to keep. A residue system whose moduli are the prime-power
factors of $b^k$ carries exactly the information of the last $k$ $b$-adic digits — the
Chinese remainder theorem is the isomorphism $\mathbb{Z}/b^k \cong \prod \mathbb{Z}/p_i^{k}$,
and letting $k \to \infty$ is what turns the residue system's independent channels into
$\mathbb{Z}_b \cong \prod \mathbb{Z}_{p_i}$.

## Things worth knowing

**Exact until it isn't.** `AdicNumeral(10, 1/3)` is an exact rational, and its expansion
can be produced to any depth. A Hensel lift is known only modulo $b^{prec}$ and says so
with `+ O(b^prec)`; anything computed from it inherits the cap. The default precision is
20 digits.

**Composite bases decline division by non-units.** `AdicNumeral(10, 3) / 2` is left
standing: 2 has no inverse in $\mathbb{Z}_{10}$, and there is no $10$-adic field to put
$3/2$ in. Prime bases divide by anything non-zero.

**Digits are listed least significant first.** `AdicDigits` lists from the valuation
upward, because that is the end the expansion has; `AdicExpansion` prints them the
familiar way round with the infinite end marked by an ellipsis.

**Pinned against Sage.** Expansions, valuations, square roots and products are checked
against Sage's `Zp`/`Qp` for prime bases; Sage has no composite bases, so those are pinned
by their algebra — the idempotents, the zero divisor, $1/3 \times 3 = 1$.
