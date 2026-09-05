# Polytopes & their combinatorics

Many of enumeratio's collections aren't just lists — they're the **faces of a polytope**. A set composition is a
face of the permutahedron; a signed subset a face of the cross-polytope; a dissection a face of the associahedron.
This page is a short field guide to those polytopes, the coordinates that place them in space, and the named maps
that relate them. Every collection named below is live in the [explorer](/explore/collection/) — toggle **Polytope** on a
polytope collection, or open the **Projective space** tab to see them together.

## The idea

A polytope's **faces of every dimension** — vertices, edges, 2-faces, … up to the whole body — are themselves a
combinatorial collection. The correspondence is always the same shape:

- the **vertices** (0-faces) are the "maximal" objects (permutations, triangulations, …),
- **higher faces** are "partial" versions of them (ordered set partitions, dissections, …),
- a face's **dimension** drops as it gets coarser: `dim = (top dim) − (how refined it is)`,
- a **coordinate** (usually the barycentre of the vertices it spans) embeds each face as a point.

So a polytope collection carries its geometry as *properties* (a coordinate, a dimension), and **maps** to its
combinatorial representative and to other collections.

## The three polytopes

| polytope | collection (faces) | vertices | dimension | # faces | coordinate |
|---|---|---|---|---|---|
| **permutahedron** $P_n$ | [`set_compositions`](/explore/collection/set_compositions) | permutations $\mathfrak S_n$ | $n-1$ | Fubini $a_n$ | barycentre |
| **cross-polytope** $\beta_n$ (octahedron at $n{=}3$) | [`signed_subsets`](/explore/collection/signed_subsets) | $\pm e_k$ (signed singletons) | $n$ | $3^n$ | signed indicator |
| **associahedron** $K_n$ | [`dissections`](/explore/collection/dissections) | triangulations = [binary trees](/explore/collection/binary_trees) | $n-1$ | little Schröder $s_n$ | Loday |

The polytope itself is surfaced as its own collection — [`permutahedron`](/explore/collection/permutahedron),
[`cross_polytope`](/explore/collection/cross_polytope), [`associahedron`](/explore/collection/associahedron) — an
order-isomorphic sibling of the combinatorial one that carries the realization and maps back to it.

### Faces as partial permutations

The permutahedron is the cleanest example. Its **vertices** are the $n!$ permutations. A **face of dimension $d$**
is a *strict weak ordering* with $n-d$ classes — i.e. an [ordered set partition](/explore/collection/set_compositions)
(a set composition) into $k = n-d$ blocks. So

$$ \dim(\text{face}) = n - (\text{number of blocks}). $$

A single block (dim $n-1$) is the whole body; all singletons (dim 0) is a permutation. The face poset is exactly
the Fubini number $a_n = 1,1,3,13,75,541,\dots$ of ordered set partitions. The other polytopes work the same way:
cross-polytope faces are signed subsets (dim $= |s|-1$), associahedron faces are dissections
(dim $= (n-1) - \#\text{diagonals}$).

## The projective space

To draw a $d$-dimensional polytope whose coordinates are a $(d{+}1)$-vector, we project $\mathbb R^{d+1}$ onto the
hyperplane $\sum x_i = 0$ using a fixed orthonormal basis — the **Helmert basis** (the "H" projection). It sends the
$(d{+}1)$-component coordinates to a genuine $d$-D scene, and because the basis is shared across polytopes, several
can be laid into **one projective space** at once. That shared view — where you can see the containment
$\text{tetrahedron} \supseteq \text{associahedron} \supseteq \text{permutahedron}$, the inscribed simplices, and the
tessellations live — has its own page:

**→ [The shared projective space](/develop/playground/helmert-projection)** — every polytope overlaid in one coordinate system, live.

The rest of this page stays with the *individual* polytopes: their coordinates, duals, containments, and maps.

## The polytope zoo

The projective space isn't only the three headline polytopes — it's a whole family, tied together by **duality**,
**containment**, and the **truncation** operations of Coxeter geometry. Here's the wider cast ($f$-vectors are the
$d=3$ solid; ✓ = enumeratio has the collection, — = not yet):

| polytope | dual | coordinate | rep collection | $f$ ($d{=}3$) | tiles? |
|---|---|---|---|---|---|
| **simplex** (tetrahedron) | self-dual | $e_k$ | — (Boolean lattice of subsets) | 4,6,4,1 | no |
| **permutahedron** $P_n$ | tetrakis hexahedron ($n{=}4$) | barycentre | [`set_compositions`](/explore/collection/set_compositions) ✓ | 24,36,14,1 | **yes** ($\tilde A_{n-1}$) |
| **associahedron** $K_n$ | (no classical name) | Loday | [`dissections`](/explore/collection/dissections) ✓ | 14,21,9,1 | no |
| **cube / hypercube** $\gamma_n$ | cross-polytope | $\pm 1$ axis-aligned | [`subsets`](/explore/collection/subsets) ✓ | 8,12,6,1 | **yes** ($\mathbb Z^n$) |
| **cross-polytope** $\beta_n$ (octahedron) | cube | $\pm e_k$ | [`signed_subsets`](/explore/collection/signed_subsets) ✓ | 6,12,8,1 | no |
| **hypersimplex** $\Delta(2,m)$ | cube (at $m{=}4$) | $0/1$ with two 1's | [`subsets`](/explore/collection/subsets)$(m,2)$ fibre | 6,12,8,1 | no |
| **cuboctahedron** | rhombic dodecahedron | perms of $(\pm1,\pm1,0)$ | — | 12,24,14,1 | no |
| **rhombic dodecahedron** | cuboctahedron | $(\pm1,\pm1,\pm1)\cup(\pm2,\mathbf 0)$ | — | 14,24,12,1 | **yes** (FCC/$A_3$) |
| **truncated tetrahedron** | triakis tetrahedron | perms of $(\pm1,\pm1,\pm3)$, even $-$ | — | 12,18,8,1 | no |
| **truncated cuboctahedron** (type-B permutahedron) | disdyakis dodecahedron | perms of $(\pm1,\pm(1{+}\sqrt2),\pm(1{+}2\sqrt2))$ | [`signed_permutations`](/explore/collection/signed_permutations) † | 48,72,26,1 | **yes** ($\tilde B_3$) |

The first three rows plus the cross-polytope are **wired polytope collections** (order-isomorphic siblings of their
representatives, carrying the coordinate + face maps); the cube/hypercube is a live layer whose `base_polytope`
wiring is still to come; **†** the flat $B_n$ combinatorics is realized ([`signed_permutations`](/explore/collection/signed_permutations)) but its geometry is
unbuilt; everything from the cuboctahedron down is future.

### Duality

- **cube ↔ cross-polytope** — exact metric polar duals ($[-1,1]^n$ polar $=\mathrm{conv}(\pm e_k)$): vertices and
  facets swap, edge count fixed. At $n{=}3$, cube $8/12/6 \leftrightarrow$ octahedron $6/12/8$. (The [`signed_subsets`](/explore/collection/signed_subsets)
  carrier already holds the cross-polytope's faces; read under the polar-dual convention it's a cube face too.)
- **simplex** is self-dual in every dimension.
- **cuboctahedron ↔ rhombic dodecahedron** — the Archimedean/Catalan pair ($12/24/14 \leftrightarrow 14/24/12$).
- **permutahedron $P_4$ ↔ tetrakis hexahedron**, a Catalan solid (no clean name for the dual at general $n$). The
  **associahedron** has no Catalan partner — it is neither vertex- nor facet-transitive.

### Containment

[`simplex`](/explore/collection/simplex), both hypersimplex shells, and the permutahedron are all **generalized permutahedra** — $\mathfrak S_m$-orbit
polytopes on the same braid arrangement — so their nesting is *provable*, not just visual. By the majorization (Rado)
theorem, one orbit polytope contains another exactly when its generating vector majorizes the other's; at $d{=}3$,
$$ (2,2,1,1) \prec (3,2,1,0) \prec (3,3,0,0) \prec (6,0,0,0) $$
gives, rigorously, $\text{inner hypersimplex} \subseteq \text{permutahedron} \subseteq \text{outer hypersimplex}
\subseteq \text{simplex}$. The associahedron sits between the permutahedron and the simplex (Loday's coordinates
truncate the simplex; the Tonks projection collapses the permutahedron onto it). The **dual simplex** is the exact
antipode of the simplex through the origin — together they are the stella octangula whose hull is a cube.

### Truncations — one construction, many solids

Most of the zoo is a single operation applied to the simplex and its symmetry group:

- **permutahedron = omnitruncated simplex** — truncate the $(n{-}1)$-simplex at every face under $\mathfrak S_n$
  (Coxeter type $A_{n-1}$). At $d{=}3$ the truncated octahedron is the omnitruncated tetrahedron.
- **hypersimplex $\Delta(2,m)$ = rectified simplex** — at $m{=}4$ the rectified tetrahedron *is* the octahedron (a
  real coincidence, not a general pattern).
- **cuboctahedron = rectified cube = rectified octahedron** — but only at $n{=}3$: the $n$-cube and $n$-cross-polytope
  share an edge count ($n\,2^{n-1}=2n(n{-}1)$) only there.
- **truncated cuboctahedron = omnitruncated simplex under $B_3$** — the exact type-B mirror of the permutahedron,
  with $|B_3| = 2^3\,3! = 48$ vertices against the permutahedron's $|S_4| = 24$.

The general fact worth keeping: omnitruncate a **finite** reflection group and you get its *permutahedron*;
omnitruncate an **affine** Weyl group and you get a *monohedral honeycomb* — which is why both the permutahedron
($\tilde A$) and the type-B permutahedron ($\tilde B$) tile.

### Which tile, and the parallelohedra

Three of the space-fillers here are among **Fedorov's five parallelohedra** (convex bodies that tile $\mathbb R^3$ by
translation alone): the **cube** ($\mathbb Z^3$), the **truncated octahedron** = permutahedron $P_4$ (the $A_3^*$/BCC
lattice), and the **rhombic dodecahedron** (the $A_3$/FCC lattice — the dual lattice). The permutahedron's tiling
carries the richest combinatorics (the affine symmetric group); the cube's is the free abelian $\mathbb Z^n$.

### The type-B frontier

[`signed_permutations`](/explore/collection/signed_permutations) already carries genuine type-B statistics — type-B descents/inversions, with the $B_3$ Eulerian
distribution $1,23,23,1$ (summing to $48$). What's missing is the *geometry*: a `base_polytope` realizing the type-B
permutahedron (the truncated cuboctahedron). Building it extends the existing permutahedron pattern to the $B_n$
Coxeter group — the same machinery, a different reflection group.

## Tessellation & the affine symmetric group

The permutahedron **tiles** its hyperplane: translating $P_n$ by the dual root lattice $A^*_{n-1}$ (integer vectors
summing to 0 with equal residues mod $n$; generators are the permutations of $(1,\dots,1,1{-}n)$) fills space with
copies, each sharing a facet with its neighbours. At $n{=}3$ this is the regular hexagonal tiling; at $n{=}4$ the
bitruncated cubic honeycomb. (Toggle **⊞** on the permutahedron chip in the Projective tab, $d\le 3$.)

That tiling is the geometry of the **affine symmetric group** $\tilde{\mathfrak S}_n$ (Coxeter type $\tilde A_{n-1}$) —
the [`affine_permutations`](/explore/collection/affine_permutations). An affine permutation is a window $[a_1,\dots,a_n]$ of
integers, distinct mod $n$ and summing to $n(n{+}1)/2$; it factors as $\tilde{\mathfrak S}_n \cong
\mathfrak S_n \ltimes (\text{root lattice})$, i.e. $a_i = u(i) + n\,c_i$ — a finite permutation $u$ plus a lattice
translation $c$ (which *tile* you land in). The finite $\mathfrak S_n$ is one fundamental domain; the translations
are the affine part.

In the Projective tab you can **navigate** the tiling — slide a cell along the lattice axes ($g_k$ for the
permutahedron, $e_k$ for the cube). Whole steps land on a genuine tile (an affine permutation, or an integer vector
for the cube); **fractional** steps sit *between* tiles — points of the continuous translation group $\mathbb R^d$ of
which the lattice ($\tilde{\mathfrak S}_n$, or $\mathbb Z^n$) is the discrete subgroup. So the enumerable objects are
exactly the integer points; the slider shows the continuum they're embedded in.

### Which polytopes tile — and what the tiling means

Not every polytope is a **space-filler**. When one does tile, the tiling is a group of motions with the polytope as
fundamental domain — so the tessellation is itself a combinatorial (indeed group-theoretic) object:

- **permutahedron** — tiles by $A^*_{n-1}$; the group is the affine symmetric group, the tiles are the
  [`affine_permutations`](/explore/collection/affine_permutations) above.
- **cube / hypercube** — tiles by the integer lattice $\mathbb Z^n$ (the cubic honeycomb); its group is the free
  abelian $\mathbb Z^n$ of integer translations — the *abelian* analogue of the affine symmetric group.
  Combinatorially the hypercube is [subsets / binary words](/explore/collection/subsets), and a lattice translate just
  offsets the coordinate by an integer vector — while a **Gray code** is a Hamiltonian path along the cube's own
  edges ([`gray_codes`](/explore/collection/gray_codes)). *(Live in the Projective tab — toggle **⊞** on the hypercube
  chip; a `base_polytope` wiring for a cube collection is still to come.)*
- **simplex, associahedron, cross-polytope** — do **not** tile space on their own.

So "moving around the space" is two distinct kinds of motion: the **rigid motions** of a single polytope (its
symmetry group — the maps below), and the **translations** that carry it to a neighbouring tile (its affine/lattice
group). Only the first are endomaps of a collection; the second are the affine collection.

## The maps (a glossary)

Relationships between the collections, and the motions of the polytopes, are all **maps** — composable in the CLI
with `--through` and visible on the [`--at`](/develop/packages/cli/) element card.

- **Tonks projection** — the cellular surjection permutahedron $\twoheadrightarrow$ associahedron. Realized on
  vertices by the **sylvester map** `permutations → binary_trees`: insert the word into a *binary search tree* and
  take its shape. Its fibres are the **sylvester classes** (permutations with the same BST), counted by $C_n$.
- **Loday realization** — integer coordinates of the associahedron: a triangulation's $i$-th coordinate is
  (leaves left)·(leaves right) at internal node $i$ (infix order), on the hyperplane $\sum = \binom{n+1}{2}$.
- **First-return decomposition** — a Dyck word factors as $1\,L\,0\,R$ (a leading up-step, its matching down-step,
  the interior $L$, the remainder $R$); the recursion behind Dyck ↔ binary tree ↔ triangulation.
- **Biane bijection** — Dyck paths ↔ [non-crossing partitions](/explore/collection/non_crossing_partitions).
- **RSK** (Robinson–Schensted–Knuth) — a permutation ↔ a pair $(P,Q)$ of same-shape [standard
  tableaux](/explore/collection/standard_tableaux), by row insertion. See [Tableaux](/learn/explorations/tableaux) for the worked
  correspondence, the hook-length formula, and the partition-algebra (Schur–Weyl) connection.
- **cycle type / cycle partition** — a permutation's cycles as an integer partition / a set partition.

### Rigid motions of the permutahedron

The symmetry group is $\mathfrak S_n \times \mathbb Z_2$; three permutation maps generate the motions (compose them
with `--through`):

- **`complement`** ($w_i \mapsto n{+}1{-}w_i$) — the **central inversion** (antipode).
- **`reverse`** (read the word backwards) — a **reflection**.
- **`cyclic_shift`** (the $n$-cycle on values) — a **rotation** (order $n$).

The tessellation **translations** are *not* symmetries of a single permutahedron — they leave the fundamental tile,
and belong to the affine group above.

## Named number sequences

Each polytope/collection is counted by a classic sequence:

$$
n! \;\;(\text{permutations}), \qquad
a_n \;\;(\text{ordered set partitions, Fubini}), \qquad
C_n = \tfrac{1}{n+1}\tbinom{2n}{n} \;\;(\text{binary trees / triangulations}),
$$
$$
s_n = 1,1,3,11,45,197,\dots \;\;(\text{dissections, little Schröder}), \qquad
3^n \;\;(\text{signed subsets}), \qquad
T_n \;\;(\text{standard tableaux, telephone}).
$$

Their triangles (a statistic's distribution per size) are one command away —
`enumeratio permutations size=1:6 --triangle inversions` prints the Mahonian triangle; `--triangle descents` the
Eulerian; set-partition `blocks` the Stirling triangle; Dyck `valleys` the Narayana.
