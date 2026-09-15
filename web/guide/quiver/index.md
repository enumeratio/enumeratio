# Path Algebras

A [quiver](<https://en.wikipedia.org/wiki/Quiver_(mathematics)>) is a directed multigraph —
vertices, and arrows between them, with loops and parallel arrows allowed. Its
[path algebra](https://en.wikipedia.org/wiki/Path_algebra) $kQ$ has a basis of all
directed **paths**, one trivial path $e_v$ per vertex included, and the product is
concatenation:

$$p \cdot q = \begin{cases} pq & \text{if } q \text{ starts where } p \text{ ends} \\ 0 & \text{otherwise}\end{cases}$$

Like the [incidence algebra](/guide/incidence/), most products are zero. Unlike every
other family here, this one **need not be finite-dimensional**.

## One loop and the algebra is infinite

$kQ$ is finite-dimensional exactly when $Q$ is **acyclic**. A single loop gives the paths
$e, a, a^2, a^3, \ldots$ — the Jordan quiver, whose path algebra is the polynomial ring
$k[x]$. There is no finite basis and no dimension, so `Basis` and `AlgebraDimension`
have nothing to return and leave the call standing rather than enumerating forever.

<Story title="Acyclic or not">
<template #description>The linear quiver is acyclic and has a dimension; the Jordan quiver has a loop, so its dimension does not exist and the call stays put.</template>
<notatio-cell value="QuiverIsAcyclic(LinearQuiver(4))" />
<notatio-cell value="QuiverIsAcyclic(JordanQuiver)" />
<notatio-cell value="AlgebraDimension(PathAlgebra(LinearQuiver(4)))" />
<notatio-cell value="AlgebraDimension(PathAlgebra(JordanQuiver))" />
</Story>

That distinction is the whole reason this family is worth having next to the others:
every previous one was finite by construction, and this is the first place where "there
is no answer" is a _structural_ fact about the input rather than a missing feature.

## Aₙ's path algebra is a chain's incidence algebra

The linear quiver $1 \to 2 \to \ldots \to n$ has exactly one path from $i$ to $j$ when
$i \le j$, and none otherwise. So its paths are the **intervals of a chain**, and $kA_n$
is the [incidence algebra](/guide/incidence/) of `Chain(n)` — same dimension
$\binom{n+1}{2}$, same product, two libraries describing one object from different
directions.

<Story title="The same algebra, twice">
<template #description>Both are C(7,2) = 21.</template>
<notatio-cell value="AlgebraDimension(PathAlgebra(LinearQuiver(6)))" />
<notatio-cell value="AlgebraDimension(IncidenceAlgebra(Chain(6)))" />
</Story>

The path count is verified a second way in the tests, against powers of the adjacency
matrix: paths of length $\ell$ are the entries of $A^\ell$, and an acyclic quiver on $n$
vertices has none longer than $n-1$. Enumeration and linear algebra agree.

## Composition, and zero

<Story title="Concatenate or annihilate">
<template #description>1→2 then 2→3 composes. The other order does not meet, so it is zero — not an error.</template>
<notatio-cell value="QuiverCompose(LinearQuiver(4), QuiverPath(1, [0]), QuiverPath(2, [1]))" />
<notatio-cell value="QuiverCompose(LinearQuiver(4), QuiverPath(2, [1]), QuiverPath(1, [0]))" />
</Story>

A path is written `QuiverPath(start, [arrow indices])`, so the trivial path at $v$ is
`QuiverPath(v, [])`. Those trivial paths are the **local identities**:

$$e_{\text{start}}\,p \;=\; p \;=\; p\,e_{\text{end}},$$

and together they sum to the identity of the algebra.

## Parallel arrows are distinct

`Quiver(n, [[from,to],…])` builds one explicitly, and arrows are indexed by position —
so two arrows with the same endpoints are two different basis elements. The Kronecker
quiver is the smallest example: two vertices, two parallel arrows, four paths.

<Story title="The Kronecker quiver">
<template #description>Four paths: two trivial, two arrows. The two arrows do not compose with each other, so their product is zero.</template>
<notatio-cell value="AlgebraDimension(PathAlgebra(Quiver(2, [[1, 2], [1, 2]])))" />
<notatio-cell value="Basis(PathAlgebra(KroneckerQuiver))" />
</Story>

## Things worth knowing

**Named quivers are recognised, not declared.** `JordanQuiver` and `KroneckerQuiver` are
bare symbols. Declaring them as nullary functions gave them the type `() -> value`, which
then failed `PathAlgebra`'s `value` parameter — an undeclared symbol types as `unknown`
and passes. Same lesson as the named hypercomplex algebras.

**Composition takes its quiver.** A path does not know which quiver it belongs to, so
`QuiverCompose(quiver, p, q)` names it rather than riding the shared ordered product.

**Not built yet.** Representations of a quiver — the actual subject, and where
[Gabriel's theorem](https://en.wikipedia.org/wiki/Gabriel%27s_theorem) lives: a connected
quiver has finitely many indecomposable representations exactly when its underlying graph
is a Dynkin diagram of type $A$, $D$ or $E$. Also quotients by an admissible ideal, which
is how a cyclic quiver is made finite-dimensional in practice.
