# Incidence Algebras

The [incidence algebra](https://en.wikipedia.org/wiki/Incidence_algebra) of a finite
poset $P$ has a basis indexed by its **intervals** — the pairs $x \le y$ — and a product
that is composition:

$$e_{[x,y]} \cdot e_{[u,z]} = \begin{cases} e_{[x,z]} & y = u \\ 0 & \text{otherwise}\end{cases}$$

Composable intervals compose; non-composable ones **annihilate**. That makes this the
first family here whose product is usually zero — an honest annihilation, not a refusal
to answer.

## The point is the Möbius function

The **zeta function** $\zeta(x,y) = 1$ on every interval is an element of this algebra,
and because a poset can be listed in a linear extension, $\zeta$ is upper-triangular
with ones on the diagonal — so it is **invertible over the integers**. Its inverse is the
[Möbius function](https://en.wikipedia.org/wiki/M%C3%B6bius_function) $\mu$, defined by
the recursion that inverting forces:

$$\mu(x,x) = 1, \qquad \mu(x,y) = -\sum_{x \le z < y} \mu(x,z).$$

That single fact — $\zeta * \mu = \delta$ — is **Möbius inversion**, and it is the test
the whole package rests on, checked as a matrix identity on every poset here.

What makes it worth building is that _specialising the poset recovers classical
theorems._

## The divisor lattice is number theory

Order the divisors of $n$ by divisibility, and the poset Möbius function of $[a,b]$ is
exactly the classical $\mu(b/a)$ — zero when a square divides it, $(-1)^k$ otherwise.
Number theory's Möbius function is not an analogy here; it is this one, on this poset.

<Story title="μ on the divisors">
<template #description>30 = 2·3·5 is squarefree with three primes, so μ = −1. 12 is divisible by 4, so μ = 0.</template>
<notatio-cell value="MoebiusFunction(DivisorLattice(30), 1, 30)" />
<notatio-cell value="MoebiusFunction(DivisorLattice(12), 1, 12)" />
<notatio-cell value="MoebiusFunction(DivisorLattice(30), 5, 30)" />
</Story>

The tests check this against an independently written classical $\mu$ for every interval
of $D(12)$, $D(30)$, $D(36)$, $D(60)$ and $D(210)$.

## The Boolean lattice is inclusion–exclusion

Order subsets of $\{1,\ldots,n\}$ by inclusion and $\mu([S,T]) = (-1)^{|T \setminus S|}$.
Möbius inversion over this poset _is_ the inclusion–exclusion principle — the alternating
signs everyone writes by hand are the Möbius function of the Boolean lattice.

<Story title="μ on subsets">
<template #description>Three elements added, so (−1)³. Adding two gives +1.</template>
<notatio-cell value="MoebiusFunction(BooleanLattice(3), [], [1, 2, 3])" />
<notatio-cell value="MoebiusFunction(BooleanLattice(3), [], [1, 2])" />
<notatio-cell value="MoebiusFunction(BooleanLattice(3), [1], [1, 2, 3])" />
</Story>

## Inversion, both ways

`PosetSumDown` computes $g(y) = \sum_{x \le y} f(x)$; `MoebiusInvert` undoes it. The two
are inverse on every poset here, which is the theorem in executable form.

<Story title="Möbius inversion">
<template #description>Sum down the chain, then invert: the original comes back. On a chain the inversion is just first differences.</template>
<notatio-cell value="PosetSumDown(Chain(4), [1, 2, 3, 4])" />
<notatio-cell value="MoebiusInvert(Chain(4), PosetSumDown(Chain(4), [1, 2, 3, 4]))" />
</Story>

## Dimension counts intervals

<Story title="How big is the algebra?">
<template #description>A chain on n has C(n+1,2) intervals; the Boolean lattice on n has 3ⁿ — for each element, it is in S, in T\S, or in neither.</template>
<notatio-cell value="AlgebraDimension(IncidenceAlgebra(Chain(4)))" />
<notatio-cell value="AlgebraDimension(IncidenceAlgebra(BooleanLattice(3)))" />
<notatio-cell value="AlgebraDimension(IncidenceAlgebra(DivisorLattice(12)))" />
</Story>

## Things worth knowing

**The linear extension is load-bearing, and it is easy to get wrong.** Elements are
stored so that $i \le j$ whenever element $i \le$ element $j$; that is what makes
$\zeta$ triangular and therefore invertible over ℤ. Sorting with "is $a \le b$?" as a
comparator does **not** produce one — on a genuine partial order that comparator is not
transitive, and `DivisorLattice(60)` came out with 12 before 3. Sorting by how many
elements lie below each one does work, because $x < y$ forces a strictly larger
down-set.

**Posets available:** `Chain(n)`, `BooleanLattice(n)` (elements are subsets),
`DivisorLattice(n)` (elements are divisors). The element type differs per poset, and
each one reads and prints its own.

**Not built yet.** The partition lattice — whose Möbius function is $(-1)^{k-1}(k-1)!$,
and which would connect this page to the [diagram
algebras](/guide/diagram-algebras/) and set partitions. Also the characteristic
polynomial, and general element arithmetic: only the interval basis and the two named
functions $\zeta$ and $\mu$ are here, not arbitrary elements of the algebra.
