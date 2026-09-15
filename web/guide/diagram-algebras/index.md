# Diagram Algebras

A [diagram algebra](https://en.wikipedia.org/wiki/Brauer_algebra) is an algebra whose
basis you can _draw_. An element of the [partition
algebra](https://en.wikipedia.org/wiki/Partition_algebra) $P_n(\delta)$ is a set
partition of $2n$ points — a top row $1…n$ and a bottom row $1'…n'$ — pictured as two
rows of dots with each block joined up:

<Story title="A diagram is a picture">
<template #description>Three strands. The block {1, 2, −1, −2} joins both rows; {3, −3} runs straight down.</template>
<notatio-figure kind="diagram" value="[0,0,1,0,0,1]" />
<notatio-figure kind="diagram" value="[0,1,2,0,1,2]" />
<notatio-figure kind="diagram" value="[0,1,2,1,0,2]" />
</Story>

Multiplication is geometric, and it is the whole subject: **stack $a$ above $b$, glue
$a$'s bottom row to $b$'s top row, read off which outer points are now connected, and
throw the middle away.** A block that ends up living entirely in the discarded middle
was a closed loop, and each closed loop contributes a factor of the **loop parameter**
$\delta$. So the algebra is defined over $\mathbb{Z}[\delta]$, and $\delta$ stays a
symbol here unless you give it a value.

## The lattice of subalgebras

Where the [hypercomplex families](/guide/hypercomplex/) differed only in a square and
a commutation rule, these differ only in **which diagrams are admitted** — and each
restriction is closed under stacking, so each one is a subalgebra. That is the whole
parameterisation:

| Algebra                     | Diagrams admitted          | Dimension                | Sequence         |
| --------------------------- | -------------------------- | ------------------------ | ---------------- |
| `PartitionAlgebra(n)`       | all set partitions of $2n$ | $B(2n)$                  | Bell             |
| `PlanarPartitionAlgebra(n)` | planar ones                | $C(2n)$                  | Catalan          |
| `BrauerAlgebra(n)`          | perfect matchings          | $(2n-1)!!$               | double factorial |
| `TemperleyLiebAlgebra(n)`   | planar perfect matchings   | $C(n)$                   | Catalan          |
| `MotzkinAlgebra(n)`         | planar, blocks of size ≤ 2 | $M(2n)$                  | Motzkin          |
| `RookAlgebra(n)`            | partial permutations       | $\sum \binom{n}{k}^2 k!$ | rook             |
| `SymmetricGroupAlgebra(n)`  | permutations               | $n!$                     | factorial        |

Every one of those dimensions is a sequence enumeratio already counts — which is the
point of putting these here rather than anywhere else.

<Story title="Dimensions are the counting sequences">
<template #description>B(6) = 203, and the catalogue's own BellNumber agrees.</template>
<notatio-cell value="AlgebraDimension(PartitionAlgebra(3))" />
<notatio-cell value="BellNumber(6)" />
<notatio-cell value="AlgebraDimension(TemperleyLiebAlgebra(4))" />
<notatio-cell value="CatalanNumber(4)" />
</Story>

The dimension comes from the closed form, so it answers well past the point where
listing the basis would be useful.

<Story title="Dimension without enumeration">
<notatio-cell value="AlgebraDimension(PartitionAlgebra(6))" />
<notatio-cell value="AlgebraDimension(BrauerAlgebra(8))" />
<notatio-cell value="Basis(TemperleyLiebAlgebra(3))" />
</Story>

## The product, and where δ comes from

Write a diagram as `Diagram([[1,2],[-1,-2]])` — blocks of signed labels, positive on the
top row and negative on the bottom. The Temperley–Lieb generator $e_1$ is the **cup-cap**:
it joins the two top points to each other and the two bottom points to each other.

Stack $e_1$ on itself and the middle closes a loop — which is exactly the relation
$e_1^2 = \delta e_1$, the defining relation of the Temperley–Lieb algebra.

<Story title="e₁² = δe₁">
<template #description>The cup-cap squared: one closed loop, so one factor of δ.</template>
<notatio-figure kind="diagram" value="[0,0,1,1]" />
<notatio-cell value="CircleTimes(Diagram([[1, 2], [-1, -2]]), Diagram([[1, 2], [-1, -2]]))" />
</Story>

The product is the **ordered** one — `NonCommutativeMultiply`, or infix `⊗`, the same
head the hypercomplex units use. A diagram algebra is not commutative, so `×` is the
wrong home for it, for exactly the reason set out
[there](/guide/hypercomplex/#design-considerations-recorded).

The other Temperley–Lieb relations fall out of the same stacking:

<Story title="e₁e₂e₁ = e₁ in TL₃">
<template #description>No loop closes, and the result is e₁ back again — no δ in sight.</template>
<notatio-cell value="CircleTimes(
             Diagram([[1, 2], [-1, -2], [3, -3]]),
             Diagram([[2, 3], [-2, -3], [1, -1]]),
             Diagram([[1, 2], [-1, -2], [3, -3]]),
           )" />
</Story>

## Containment tells the subalgebras apart

Because each algebra is a class of diagrams, membership is a real question with a real
answer — and it is how the inclusions become checkable. The crossing $s_1$ is a Brauer
diagram and a permutation, but not planar, so it is not Temperley–Lieb.

<Story title="Which algebra is this diagram in?">
<notatio-figure kind="diagram" value="[0,1,2,1,0,2]" />
<notatio-cell value="Diagram([[1, -2], [2, -1], [3, -3]]) in BrauerAlgebra(3)" />
<notatio-cell value="Diagram([[1, -2], [2, -1], [3, -3]]) in TemperleyLiebAlgebra(3)" />
<notatio-cell value="Diagram([[1, 2], [-1, -2], [3, -3]]) in TemperleyLiebAlgebra(3)" />
<notatio-cell value="Diagram([[1, 2], [-1, -2], [3, -3]]) in SymmetricGroupAlgebra(3)" />
</Story>

A block of three points is a partition diagram and nothing smaller — Brauer and below
admit only blocks of size two.

<Story title="Bigger blocks leave the matchings behind">
<notatio-figure kind="diagram" value="[0,0,1,0,2,1]" />
<notatio-cell value="Diagram([[1, 2, -1], [3, -3], [-2]]) in PartitionAlgebra(3)" />
<notatio-cell value="Diagram([[1, 2, -1], [3, -3], [-2]]) in BrauerAlgebra(3)" />
</Story>

## The orbit basis

The diagram basis $d_\lambda$ is the obvious one — one element per set partition — but it is
not the one the partition algebra's representation theory is written in. That is the
**orbit basis** $x_\lambda$, and the difference is a quantifier:

> $d_\lambda$ asks for those points to be connected.
> $x_\lambda$ asks for them to be connected **and nothing else**.

So a diagram is the union of the orbits that refine it, and the two bases are related by
summing over the partition lattice and inverting:

$$
d_\lambda = \sum_{\mu \succeq \lambda} x_\mu,
\qquad
x_\lambda = \sum_{\mu \succeq \lambda} \mu_\Pi(\lambda, \mu)\, d_\mu .
$$

<Story title="A quantifier, as a change of basis">
<template #description>The coarsest partition has nothing above it, so the two bases agree there.</template>
<notatio-cell value="InOrbitBasis(Diagram([[1], [-1]]))" />
<notatio-cell value="InDiagramBasis(OrbitDiagram([[1], [-1]]))" />
<notatio-cell value="InOrbitBasis(Diagram([[1, -1]]))" />
<notatio-cell value="DiagramCoarsenings(Diagram([[1], [-1]]))" />
</Story>

The Möbius function is the **partition lattice's**, not the Boolean one's:

$$
\mu_\Pi(\lambda, \mu) = \prod_{B \in \mu} (-1)^{k_B - 1} (k_B - 1)!,
$$

with $k_B$ the number of $\lambda$-blocks inside the block $B$. That is worth setting beside
the [Hopf-algebra bases](/guide/hopf/), which come from the same kind of inversion over
the **Boolean** lattice, where the Möbius function is only a sign. The factorials here are
the difference between merging any set of blocks and merging only adjacent ones — and they
are checked against the recursion $\sum_{\lambda \le \nu \le \mu} \mu_\Pi(\lambda,\nu) = 0$
rather than taken on faith.

<Story title="Möbius over the partition lattice">
<template #description>Merging four points into one block: (−1)³·3! = −6. Coarsening is partitioning the blocks, so there are Bell(4) = 15 ways.</template>
<notatio-cell value="PartitionMobius(Diagram([[1], [2], [-1], [-2]]), Diagram([[1, 2, -1, -2]]))" />
<notatio-cell value="PartitionMobius(Diagram([[1, -1]]), Diagram([[1, -1]]))" />
<notatio-cell value="BellNumber(4)" />
</Story>

What the orbit basis buys is a statement that has no clean form in the diagram basis at
all: the map onto the centraliser algebra of the symmetric group acting on $V^{\otimes n}$
kills $x_\lambda$ exactly when $\lambda$ has more blocks than $\delta$. Specialising the
loop parameter to an integer therefore just deletes basis elements — which is why the
subject is written in $x$.

## Things worth knowing

**The loop parameter is a free symbol.** These algebras are defined over
$\mathbb{Z}[\delta]$, so a product returns a $\delta$-power times a diagram and leaves
$\delta$ alone. Substitute a value when you want one — at $\delta = 1$ the Brauer
algebra degenerates, and the interesting representation theory lives at special values.

**A diagram must partition all $2n$ points.** `Diagram([[1,-1],[2]])` is missing $-2$,
so it is malformed and is left exactly as written rather than read as having an implicit
singleton. Diagrams also normalise: blocks come back in canonical order, so a written
diagram and a computed one are the same expression.

**Two libraries, one set of heads.** `Basis`, `AlgebraDimension`, `Element` and the
ordered product are declared once by `@enumeratio/algebra` and dispatched over
registered providers. compute-engine refuses a second `ce.declare` of a head an
extension already declared, so this seam is what lets the diagram algebras and the
hypercomplex units live on one engine — and what makes adding a third family a matter of
registering one object.

**What is not here yet.** Representation theory: the cell / standard modules, the
semisimplicity criteria (which fail at special δ), and the Jones basic construction.
The Jones polynomial via the Temperley–Lieb trace is the obvious next thing to build,
and it would tie these diagrams to the knot-theory side of the catalogue.
