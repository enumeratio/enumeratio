# Group Algebras

The [group algebra](https://en.wikipedia.org/wiki/Group_ring) $k[G]$ has a basis of the
group's elements and the group's own multiplication as its product, extended bilinearly.
It is the most elementary construction in this section — which is why it comes last
rather than first. The interesting part is not the product. It is the **centre**.

$k[G]$ is commutative exactly when $G$ is, which is usually false. But its centre is
always commutative, and it always has a basis of **class sums**: one element per
conjugacy class, obtained by adding that class up. So a non-commutative algebra carries a
canonical commutative subalgebra, whose dimension is the number of conjugacy classes —
which is also the number of irreducible characters, and the doorway to representation
theory.

<Story title="Commutative or not">
<template #description>Cyclic groups are abelian; dihedral ones past n = 2 are not.</template>
<notatio-cell value="GroupIsAbelian(CyclicGroup(6))" />
<notatio-cell value="GroupIsAbelian(DihedralGroup(4))" />
<notatio-cell value="GroupOrder(DihedralGroup(4))" />
</Story>

## The class sums span the centre

<Story title="A commutative subalgebra of a non-commutative algebra">
<template #description>A single reflection is not central; the class sum containing it is. The first class is always the identity alone.</template>
<notatio-cell value="ClassSum(DihedralGroup(3), 2)" />
<notatio-cell value="IsCentral(DihedralGroup(3), ClassSum(DihedralGroup(3), 2))" />
<notatio-cell value='IsCentral(DihedralGroup(3), GroupBasis("s0"))' />
</Story>

The class sums have **disjoint supports**, so they are linearly independent, so counting
them counts the centre's dimension. The tests check that against the closed forms:
$n$ classes for $\mathbb{Z}_n$, $(n+3)/2$ for $D_n$ with $n$ odd, $(n+6)/2$ for $n$ even.

<Story title="Counting classes">
<template #description>Z₆ is abelian so every element is its own class. D₃ ≅ S₃ has three; D₄ has five.</template>
<notatio-cell value="GroupCentreDimension(CyclicGroup(6))" />
<notatio-cell value="GroupCentreDimension(DihedralGroup(3))" />
<notatio-cell value="GroupCentreDimension(DihedralGroup(4))" />
<notatio-cell value="ConjugacyClasses(DihedralGroup(3))" />
</Story>

## k[Zₙ] is k[x]/(xⁿ−1)

For a cyclic group the product just adds indices mod $n$ — so $k[\mathbb{Z}_n]$ is a
polynomial ring modulo a single relation. When the base field has $n$-th roots of unity
it splits into $n$ copies of the field, which is the same CRT-flavoured splitting the
[finite hypercomplex page](/guide/hypercomplex/finite) and the
[residue numerals](/guide/numerals/) keep running into.

<Story title="Adding indices">
<template #description>2 + 5 = 7 ≡ 1. And (1 + x)(1 + x⁵) = 2 + x + x⁵.</template>
<notatio-cell value='GroupProduct(CyclicGroup(6), GroupBasis("2"), GroupBasis("5"))' />
<notatio-cell value="GroupOrder(GroupDirectProduct(CyclicGroup(2), CyclicGroup(3)))" />
</Story>

## The dihedral relations

Elements are written `k` for $r^k$ and `s k` for $s r^k$, with $r^n = 1$, $s^2 = 1$ and
$s r s = r^{-1}$.

<Story title="s² = 1 and s r s = r⁻¹">
<template #description>s² is the identity, and conjugating r by s inverts it — r³ in D₄.</template>
<notatio-cell value='GroupProduct(DihedralGroup(4), GroupBasis("s0"), GroupBasis("s0"))' />
<notatio-cell value='GroupProduct(DihedralGroup(4), GroupProduct(
                                             DihedralGroup(4),
                                             GroupBasis("s0"),
                                             GroupBasis("1"),
                                           ), GroupBasis("s0"))' />
</Story>

## Things worth knowing

**The group axioms are verified, not assumed.** The multiplication tables are checked for
associativity, an identity, inverses, and the Latin-square property on every group here —
because everything downstream rests on them being groups at all.

**Several routes to the same algebra.** $k[S_n]$ is also the
[symmetric-group diagram algebra](/guide/diagram-algebras/), and also
[$H_n(q)$ at $q = 1$](/guide/hecke/). Three libraries, one object.

**`GroupProduct` takes its group**, since a basis element carries no reference to the
group it came from — the same shape as `QuiverCompose`.

**Not built yet.** Character theory: the character table, orthogonality relations, and
the decomposition of $k[G]$ into matrix blocks. That is what the centre is the doorway to,
and it is the obvious next step. Also only cyclic, dihedral and direct products —
permutation groups come in through the diagram and Hecke libraries instead.
