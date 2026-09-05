---
sidebar: false
aside: false
---

# The shared projective space

The polytopes of [Polytopes & their combinatorics](/learn/explorations/polytopes) don't just sit side by side — they live in **one
shared coordinate system**. This page lays several of them into a single projective space at once, so you can *see*
the containments, the duals, and the tessellations that the field guide describes.

<ClientOnly>
  <SharedSpace />
</ClientOnly>

Toggle layers with the chips; drag to orbit, scroll to zoom, and use the corner controls to recenter or go
fullscreen. Set the **dimension** to 2, 3, or 4 (at $d{=}3$ you get a genuine 3-D scene).

## The Helmert projection

To draw a $d$-dimensional polytope whose coordinates are a $(d{+}1)$-vector, we project $\mathbb R^{d+1}$ onto the
hyperplane $\sum x_i = 0$ using a fixed orthonormal basis — the **Helmert basis** (the "H" projection). It sends the
$(d{+}1)$-component coordinates to a genuine $d$-D scene with an origin and negative half-axes, and it's **shared**
across polytopes, so several can be laid into one projective space at once — that shared basis is exactly what makes
this view possible. At $d{=}3$ the permutahedron renders as the truncated octahedron and the $\pm e_i$ axis points
land on a cube.

## What you're looking at

There you can see the containment

$$ \text{tetrahedron} \supseteq \text{associahedron} \supseteq \text{permutahedron}, $$

with the simplex and its dual as the two tetrahedra inscribed in the cube traced by the $\pm e_i$ axis points.
The two concentric octahedra are **hypersimplices** — the rectified simplices $\Delta(2,m)$ (orbit polytopes of
$(a,a,0,\dots)$). They are octahedra *only* at $d=3$; they are **not** the cross-polytope of the
[three-polytopes table](/learn/explorations/polytopes#the-three-polytopes) (that is its own
[`signed_subsets`](/explore/collection/signed_subsets) collection, with $2n$ vertices $\pm e_k$). For the full cast of the
polytope zoo, its duals, containments, and truncations, see the [polytopes field guide](/learn/explorations/polytopes).

## Tessellation & navigation

Two of these shapes **tile** the space — toggle **⊞** on a chip ($d\le 3$):

- the **permutahedron** by the dual root lattice $A^*_{n-1}$ (the affine symmetric group $\tilde{\mathfrak S}_n$,
  Coxeter type $\tilde A_{n-1}$) — the [`affine_permutations`](/explore/collection/affine_permutations);
- the **hypercube** ($\leftrightarrow$ [subsets](/explore/collection/subsets)) by the integer lattice $\mathbb Z^n$ (the
  cubic honeycomb) — the free abelian analogue.

With **⊞** on, tick **navigate** to slide a cell through the tiling along its lattice axes ($g_k$ for the
permutahedron, $e_k$ for the cube). Whole steps land on a genuine tile (an affine permutation, or an integer vector);
**fractional** steps sit *between* tiles — points of the continuous translation group $\mathbb R^d$ of which the
lattice is the discrete subgroup. The enumerable objects are exactly the integer points; the slider shows the
continuum they're embedded in. The deeper story — which polytopes tile and why, the affine symmetric group, and the
parallelohedra — is in the [field guide](/learn/explorations/polytopes#tessellation-the-affine-symmetric-group).
