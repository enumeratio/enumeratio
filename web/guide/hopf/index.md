# Combinatorial Hopf Algebras

Everything else in this section is an **algebra**: a product, and nothing else. A
[Hopf algebra](https://en.wikipedia.org/wiki/Hopf_algebra) also has a **coproduct**,
which takes one element to a sum of tensor pairs and pulls objects apart where the
product puts them together. The two are not independent — they must satisfy

$$\Delta(x \cdot y) = \Delta(x) \cdot \Delta(y)$$

in the tensor square. That compatibility is the whole point of the structure, and it is
also the best test available, because the product and the coproduct are written
separately and the identity relates them.

Two such algebras live here, both indexed by **compositions** (ordered lists of positive
parts), and dual to each other:

|                                                | basis      | product           | coproduct                                                               |
| ---------------------------------------------- | ---------- | ----------------- | ----------------------------------------------------------------------- |
| **NSym** — non-commutative symmetric functions | $H_\alpha$ | **concatenation** | $\Delta(H_n) = \sum_{i+j=n} H_i \otimes H_j$, extended multiplicatively |
| **QSym** — quasi-symmetric functions           | $M_\alpha$ | **quasi-shuffle** | **deconcatenation**                                                     |

The graded piece of degree $n$ has one basis element per composition of $n$, so both have
dimension $2^{n-1}$ — a count enumeratio already keeps.

## NSym: concatenate

The product could not be simpler. $\mathrm{NSym}$ is the free associative algebra on
$H_1, H_2, \ldots$, so multiplying is sticking compositions together — and it is
**non-commutative**, which is what the name records.

<Story title="Concatenation">
<template #description>Concatenation, and the two orders differ.</template>
<notatio-cell value="CircleTimes(NSymH([2]), NSymH([1, 3]))" />
<notatio-cell value="CircleTimes(NSymH([1]), NSymH([2]))" />
<notatio-cell value="CircleTimes(NSymH([2]), NSymH([1]))" />
</Story>

## QSym: quasi-shuffle

Interleave the two compositions — and at each step you may instead **add** the two
leading parts together. That third option is what makes it a _quasi_-shuffle, and it is
why $M_1 \cdot M_1 = 2M_{1,1} + M_2$ rather than just $2M_{1,1}$.

<Story title="The overlap term">
<template #description>The M₂ term is the overlap. QSym, unlike NSym, is commutative.</template>
<notatio-cell value="CircleTimes(QSymM([1]), QSymM([1]))" />
<notatio-cell value="CircleTimes(QSymM([1]), QSymM([2]))" />
<notatio-cell value="CircleTimes(QSymM([2]), QSymM([1]))" />
</Story>

## The coproduct

`Coproduct` returns a sum of `HopfTensor(left, right)` pairs. For QSym it is
deconcatenation — cut the composition at each of its gaps. For NSym it is the
multiplicative extension of splitting a single part.

<Story title="Pulling apart">
<template #description>Δ(M₁,₂) cuts at each gap. Δ(H₂) splits the part 2 as 0+2, 1+1, 2+0.</template>
<notatio-cell value="Coproduct(QSymM([1, 2]))" />
<notatio-cell value="Coproduct(NSymH([2]))" />
</Story>

Both coproducts are **coassociative**, and both satisfy the compatibility above — checked
across every pair of basis elements up to degree 3, in both algebras. Those two facts are
what make these bialgebras rather than an algebra and an unrelated map.

## The antipode

A Hopf algebra has one more piece: an antipode $S$ with
$m(S \otimes \mathrm{id})\Delta = \eta\varepsilon$. On a graded connected algebra that
axiom _determines_ $S$ by a recursion — split off the two trivial terms of $\Delta$ and

$$S(x) = -x - \sum S(x')\,x''$$

over the rest, where the left factor has strictly smaller degree. The package computes
$S$ that way and then **verifies the axiom by running it**, rather than trusting the
derivation.

<Story title="S, and S² on the commutative side">
<template #description>On a commutative Hopf algebra the antipode is an involution, so S² = id on QSym.</template>
<notatio-cell value="Antipode(QSymM([1]))" />
<notatio-cell value="Antipode(QSymM([1, 2]))" />
<notatio-cell value="Antipode(Antipode(QSymM([1, 2])))" />
</Story>

## Grading and dimension

<Story title="Graded pieces">
<template #description>2^(n−1) compositions of n. The product is homogeneous: degrees add.</template>
<notatio-cell value="AlgebraDimension(NSymAlgebra(4))" />
<notatio-cell value="AlgebraDimension(QSymAlgebra(5))" />
<notatio-cell value="HopfDegree(CircleTimes(QSymM([1]), QSymM([2])))" />
</Story>

## Two more bases, and one lattice underneath

A composition of $n$ is the same data as a **subset** of $\{1, \ldots, n-1\}$: take its
partial sums. Refining a composition adds elements to that set and coarsening removes them,
so the compositions of $n$ form a Boolean lattice — and the bases the subject is actually
written in come from summing over that lattice and inverting.

|          | definition                                                 | inverse                                                                                    |
| -------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **NSym** | $H_\alpha = \sum_{\beta \text{ coarsens } \alpha} R_\beta$ | $R_\alpha = \sum_{\beta \text{ coarsens } \alpha} (-1)^{\ell(\alpha)-\ell(\beta)} H_\beta$ |
| **QSym** | $F_\alpha = \sum_{\beta \text{ refines } \alpha} M_\beta$  | $M_\alpha = \sum_{\beta \text{ refines } \alpha} (-1)^{\ell(\beta)-\ell(\alpha)} F_\beta$  |

Those signed sums are **Möbius inversion** over the Boolean lattice, whose Möbius function
is $(-1)^{|\text{difference}|}$ — the same inversion
[the incidence algebras](/guide/incidence/) compute in general, here in closed form
because the lattice is known.

The two directions are opposite — coarsen for NSym, refine for QSym — and that is not a
slip. NSym and QSym are **dual**, with $H$ dual to $M$ and $R$ dual to $F$. So duality is
the best test available here:

$$
\langle R_\alpha, F_\beta \rangle = \delta_{\alpha\beta},
$$

and since the two transition matrices are written down separately, nothing forces them to
be inverse transposes of one another except the mathematics.

<Story title="Change of basis">
<template #description>R_(2) is just H_(2); the finer composition is the one that picks up signs.</template>
<notatio-cell value="InCompleteBasis(NSymR([1, 1]))" />
<notatio-cell value="InCompleteBasis(NSymR([2]))" />
<notatio-cell value="InMonomialBasis(QSymF([2]))" />
<notatio-cell value="InRibbonBasis(NSymH([2, 1]))" />
</Story>

### What the new bases buy

Both are first-class here — the product, coproduct, antipode and containment all work on
$R$ and $F$ directly, and answers come back in the basis the question was asked in. What
changes is how simple the answers are.

The **ribbon product** has a two-term closed form:

$$
R_\alpha \cdot R_\beta = R_{\alpha \cdot \beta} + R_{\alpha \triangleright \beta},
$$

where $\alpha \cdot \beta$ is concatenation and $\alpha \triangleright \beta$ is
_near-concatenation_ — join the two, adding $\alpha$'s last part to $\beta$'s first. That
second operation has no meaning in the $H$ basis at all.

The **ribbon antipode** is a single signed basis element:

$$
S(R_\alpha) = (-1)^{|\alpha|} R_{\alpha^{*}},
$$

for $\alpha^{*}$ the conjugate composition — the transpose of the ribbon's skew shape. In
the $H$ basis the same antipode is an alternating sum over every coarsening, so this is
about as clear a demonstration of what a good basis is for as the subject offers.

<Story title="Two terms, and one term">
<template #description>Concatenation and near-concatenation; then an antipode with a single term.</template>
<notatio-cell value="CircleTimes(NSymR([2]), NSymR([1]))" />
<notatio-cell value="CircleTimes(QSymF([1]), QSymF([1]))" />
<notatio-cell value="Antipode(NSymR([3]))" />
<notatio-cell value="ConjugateComposition([2, 1])" />
</Story>

Which involution $\alpha \mapsto \alpha^{*}$ is depends on a convention that is easy to get
backwards — at $n = 3$ both $(2,1)$ and $(1,2)$ are self-conjugate under the right one and
swap under the wrong one. It is settled here by the antipode rather than by taste: only one
of the two candidate maps makes $S(R_\alpha)$ a single term at all.

## Things worth knowing

**Tensor pairs get their own head.** `HopfTensor(a, b)`, not `CircleTimes` — that is
already the shared ordered product across the algebra libraries, and overloading it for
a genuine tensor pair would be a conflation.

**The two algebras share an index set but are not the same algebra.** Mixing $H_\alpha$
and $M_\alpha$ in one product is refused rather than silently coerced, and containment
distinguishes them.

**A sum of mixed degrees has no degree**, so `HopfDegree` leaves that call standing.

**Not built yet.** Sym itself sitting inside QSym as the symmetric functions, and the
Hopf-algebra maps between these and the other algebras in this section.
