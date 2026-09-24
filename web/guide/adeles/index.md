# Adèles and Idèles

A number you only know modulo something is still a number you can compute with. "3 mod 12"
is a set — every integer that leaves remainder 3 — and adding "5 mod 8" to it gives a set
too: everything is $0 \bmod 4$, since 4 is all the two congruences agree on. The
[profinite integers](https://en.wikipedia.org/wiki/Profinite_integer) $\hat{\mathbb{Z}}$
are what those sets approximate: a profinite integer knows its residue modulo _every_ $N$
at once, and an element "known modulo $N$" is an open ball around it.

This page follows Mathé Hertogh's thesis
[_Computing with adèles and idèles_](https://github.com/mathehertogh/adeles/blob/main/Computing_with_adeles_and_ideles.pdf)
(Leiden, 2021) and its Sage package, over $\mathbb{Q}$. Three value heads carry it —
`ProfiniteNumber`, `Adele` and `Idele` — and everything else is an existing head that
learned to take them.

## Known modulo m

`ProfiniteNumber(x, m)` is the coset $x + m\hat{\mathbb{Z}}$. It normalises to the
representative in $[0, m)$, and a modulus of 0 means exact, so it is just $x$.

<Story title="Sums and products">
<template #description>A sum is known modulo the gcd of the moduli; a product modulo the gcd of the cross terms — (3 + 12a)(5 + 8b) = 15 + 24a + 60b + 96ab, and gcd(24, 60, 96) = 12.</template>
<notatio-cell value="ProfiniteNumber(3, 12) + ProfiniteNumber(5, 8)" />
<notatio-cell value="ProfiniteNumber(3, 12) * ProfiniteNumber(5, 8)" />
<notatio-cell value="ProfiniteNumber(3, 12)^2" />
<notatio-cell value="ProfiniteNumber(-1, 12)" />
</Story>

Equality asks whether the two sets meet. That is the only honest question about values
known approximately, and it is **not transitive**: 6 mod 20 meets 6 mod 40 and 26 mod 40,
which do not meet each other.

<Story title="Equal means the sets meet">
<template #description>6 mod 20 is compatible with both; the two finer values are not compatible with each other.</template>
<notatio-cell value="Equal(ProfiniteNumber(6, 20), ProfiniteNumber(6, 40))" />
<notatio-cell value="Equal(ProfiniteNumber(6, 20), ProfiniteNumber(26, 40))" />
<notatio-cell value="Equal(ProfiniteNumber(6, 40), ProfiniteNumber(26, 40))" />
</Story>

## One prime at a time

By the Chinese remainder theorem, knowing $x \bmod 288 = 2^5 \cdot 3^2$ is knowing
$x \bmod 2^5$ and $x \bmod 3^2$ separately: $\hat{\mathbb{Z}} = \prod_p \mathbb{Z}_p$. The
$p$-adic components are the [b-adic numbers](../numerals/adic) the numerals package
already has, so `AdicNumeral(p, z)` projects, and `ProfiniteNumber` of a list of them
glues back.

<Story title="ℤ̂ = ∏ ℤ_p">
<template #description>100 mod 24 is 4 mod 8 at 2 and 1 mod 3 at 3; gluing the pieces gives it back. At 5 nothing is known, so the projection declines.</template>
<notatio-cell value="AdicNumeral(2, ProfiniteNumber(100, 24))" />
<notatio-cell value="AdicNumeral(3, ProfiniteNumber(100, 24))" />
<notatio-cell value="ProfiniteNumber([AdicNumeral(2, 4, 3), AdicNumeral(3, 1, 1)])" />
<notatio-cell value="ProfiniteNumber([AdicNumeral(2, 20, 5), AdicNumeral(3, 7, 2)])" />
</Story>

## Profinite rationals

$\hat{\mathbb{Q}} = \hat{\mathbb{Z}} \otimes \mathbb{Q}$ allows rational values and
rational moduli: $\tfrac12 \bmod \tfrac{97}{5}$ is a perfectly good element. It is
integral when some $d$ clears it into $\hat{\mathbb{Z}}$, and `Numerator` and
`Denominator` split it that way.

<Story title="Rational values and moduli">
<template #description>gcd(97/5, 10) = 1/5, and 1/2 + 1/3 = 5/6 ≡ 1/30 mod 1/5. 2/3 mod 5 is (2 mod 15)/3.</template>
<notatio-cell value="ProfiniteNumber(1/2, 97/5) + ProfiniteNumber(1/3, 10)" />
<notatio-cell value="Numerator(ProfiniteNumber(2/3, 5))" />
<notatio-cell value="Denominator(ProfiniteNumber(2/3, 5))" />
</Story>

## Profinite Fibonacci numbers

$F_n \bmod M$ is periodic in $n$, so it depends only on $n$ modulo the period. Read the
other way round (Lenstra, [_Profinite Fibonacci numbers_](http://www.nieuwarchief.nl/serie5/pdf/naw5-2005-06-4-297.pdf)):
knowing $n$ modulo $N$ pins $F_n$ down modulo every $M$ whose Pisano period divides $N$ —
the largest is $\gcd(F_N, F_{N+1} - 1)$. So `Fibonacci` is a continuous function
$\hat{\mathbb{Z}} \to \hat{\mathbb{Z}}$, and so is `LucasL`.

<Story title="Fibonacci on ℤ̂">
<template #description>The Pisano period of 11 is 10, so n ≡ 3 mod 10 fixes Fₙ ≡ 2 mod 11 and Lₙ ≡ 4 mod 11.</template>
<notatio-cell value="Fibonacci(ProfiniteNumber(3, 10))" />
<notatio-cell value="LucasL(ProfiniteNumber(3, 10))" />
<notatio-cell value="Fibonacci(ProfiniteNumber(0, 100))" />
</Story>

A function on $\hat{\mathbb{Z}}$ has a graph in $\hat{\mathbb{Z}}^2$, and Hertogh draws it
by laying $\hat{\mathbb{Z}}$ along the unit interval by its factorial digits,
$\varphi(\alpha) = \sum_i d_i/(i+1)!$ — residue classes mod $k!$ become consecutive
cells. `ProfinitePlot(f, x, k)` fills a cell when $f$ maps its column class into its row
class. Lenstra's theorem that $F_n = n$ has exactly the solutions $n = 0, 1, 5$ and two
more in $\hat{\mathbb{Z}}$ shows up where the graph crosses the diagonal.

<Story title="The graph of Fibonacci on ℤ̂">
<template #description>The identity is a diagonal; Fibonacci is a fractal that keeps meeting it.</template>
<notatio-cell value="ProfinitePlot(x, x, 4)" />
<notatio-cell value="ProfinitePlot(Fibonacci(x), x, 5)" />
</Story>

## Adèles

An [adèle](https://en.wikipedia.org/wiki/Adele_ring) of $\mathbb{Q}$ adds the one place
the profinite part leaves out — the real numbers — so
$\mathbb{A}_\mathbb{Q} = \mathbb{R} \times \hat{\mathbb{Q}}$. `Adele(r, z)` is the pair;
a rational sits on the diagonal, `Adele(q)` being $q$ at every place, and arithmetic is
componentwise.

<Story title="ℝ × ℚ̂">
<template #description>A rational multiplies both components; adèles add componentwise.</template>
<notatio-cell value="Adele(5)" />
<notatio-cell value="Adele(2, ProfiniteNumber(1, 6)) * 3" />
<notatio-cell value="Adele(1/2, ProfiniteNumber(1, 6)) + Adele(3/2, ProfiniteNumber(2, 9))" />
</Story>

## Idèles

The [idèles](https://en.wikipedia.org/wiki/Idele_class_group) are the units of the adèles,
with a finer topology: a nonzero real and, at each prime, a nonzero $p$-adic that is a unit
at all but finitely many. Over $\mathbb{Q}$ each $p$-component is $p^v u$ with $u$ a unit,
so `Idele(r, s, [...])` keeps the valuations in one positive rational $s$ and lists the
units that are known, as $p$-adics known modulo $p^n$ — Hertogh's $c \cdot U(n)$. A prime
not listed has an unknown unit. `Idele(r, q)` is principal: $q$ itself at every prime.

<Story title="The idèle group">
<template #description>7 and 1/7 are inverse. A listed component moves its valuation into the scale: 15/7 at 5 is 5 × (3/7), and 3/7 ≡ 54 mod 125.</template>
<notatio-cell value="Idele(7) * Idele(1/7)" />
<notatio-cell value="Idele(1, 1, [AdicNumeral(5, 15/7, 4)])" />
<notatio-cell value="Idele(2, 1, [AdicNumeral(3, 1/7, 5)]) * Idele(-1, 6)" />
</Story>

Every idèle is an adèle — the one whose component at $p$ is $p^v u$ — and `Adele(idèle)`
finds the coset in $\hat{\mathbb{Q}}$ that holds it. Primes with no listed unit contribute
only divisibility, and at 2 even an unknown unit is odd.

<Story title="From idèles to adèles">
<template #description>At 3 the unit is 2 mod 9; at 2 it is odd: together 11 mod 18.</template>
<notatio-cell value="Adele(Idele(1, 1, [AdicNumeral(3, 2, 2)]))" />
</Story>

## Strong approximation

Every $M \in \mathrm{GL}_n(\hat{\mathbb{Q}})$ factors as $M = B A$ with
$B \in \mathrm{GL}_n(\hat{\mathbb{Z}})$ and $A \in \mathrm{GL}_n^+(\mathbb{Q})$ — the
matrix form of "$\hat{\mathbb{Q}}^* = \hat{\mathbb{Z}}^* \cdot \mathbb{Q}_{>0}$", and the
step Hertogh's algorithms for Shimura reciprocity rest on. `ProfiniteDecomposition(m)`
finds $A$ from the Hermite normal form of the lattice $M$'s rows span, and gives back
$\{B, A\}$. It declines when $M$ is known too coarsely for $A$ to be determined.

<Story title="GL_n(ℚ̂) = GL_n(ℤ̂) · GL_n⁺(ℚ)">
<template #description>The rows of [[3, 1], [1, 1]] span the lattice with Hermite form [[1, 1], [0, 2]], and B = [[3, −1], [1, 0]] is unimodular. Known only modulo 12 — a multiple of the determinant — the same A comes out, and B is known modulo 12 in its first column and 6 in its second — A⁻¹ halves it.</template>
<notatio-cell value="ProfiniteDecomposition([[3, 1], [1, 1]])" />
<notatio-cell value="ProfiniteDecomposition([[ProfiniteNumber(3, 12), ProfiniteNumber(1, 12)], [ProfiniteNumber(1, 12), ProfiniteNumber(1, 12)]])" />
<notatio-cell value="HermiteDecomposition([[2, 3, 5], [7, 11, 13], [17, 19, 23]])" />
</Story>

## Not yet

Hertogh's package works over any number field $K$: profinite completions of its ring of
integers, idèles mapping to ray class groups, and — the thesis's destination — Hilbert
class polynomials computed through Shimura reciprocity. All of that needs number fields,
their ideals and class field theory underneath, which the engine does not have yet.
