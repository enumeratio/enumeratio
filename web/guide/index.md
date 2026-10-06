# Guides

Walkthroughs of the mathematics, each one following a family of objects far enough to
see how it is built and what it is good for. Live cells throughout — a claim you can
re-evaluate is worth more than one you have to take on faith.

Guides explain. The [explorations](/explore/) are for tinkering: fewer words, more
dials. Where a guide names an object worth turning over in your hands, it links to the
exploration that lets you.

Each guide is a page of the package it introduces, in that package's `docs/`; the
[docs](/docs/) list them with the rest of each package's pages.

## Counting

- [**Ranking and unranking**](/docs/combinatorics/ranking-and-unranking) — a combinatorial family as an
  indexed collection: `Count` and `At` over subsets, partitions, Dyck paths and
  permutations, answered without building the list.
- [**Numeral systems**](/docs/numerals/numeral-systems) — one base slot, nine systems: factoradic,
  Zeckendorf, balanced, negative, bijective, mixed, primorial, combinatorial and
  residue — two of which are the unranking maps above in disguise.
- [**Adèles and idèles**](/docs/adeles/adeles-and-ideles) — numbers known modulo m as values: profinite
  integers and rationals, the adèle ring and idèle group of ℚ, profinite Fibonacci
  numbers and strong approximation, after Hertogh's Sage package.

## Algebras

Each of these introduces an extension library and then follows where it leads. The heads
they declare are catalogued in the [symbol reference](/reference/symbol/).

- [**Hypercomplex algebras**](/docs/hypercomplex/hypercomplex-algebras) — six families of imaginary unit as
  ordinary subscripted symbols: multicomplex, split, dual, Clifford and Grassmann, with
  arithmetic, norms and inverses on compute-engine's own operators.
  - [Finite: ℤ/m and the places](/docs/hypercomplex/finite) — where these units
    already live, one CRT channel at a time.
- [**Diagram algebras**](/docs/diagram/diagram-algebras) — the partition algebra and its
  subalgebras (Brauer, Temperley–Lieb, Motzkin, rook, symmetric group), whose bases are
  pictures and whose dimensions are the Bell, Catalan and Motzkin numbers.
- [**Hecke algebras**](/docs/hecke/hecke-algebras) — $H_n(q)$, the q-deformation of the symmetric
  group algebra: same basis, deformed multiplication, and the group algebra back at
  $q = 1$.
- [**Incidence algebras**](/docs/incidence/incidence-algebras) — the algebra of a poset's intervals,
  where the zeta function's inverse is the Möbius function, and specialising the poset
  recovers number theory's $\mu$ and inclusion–exclusion.
- [**Path algebras**](/docs/quiver/path-algebras) — a quiver's paths under concatenation, and the
  first family here that need not be finite-dimensional: one loop and there is no basis
  at all.
- [**Combinatorial Hopf algebras**](/docs/hopf/hopf-algebras) — NSym and QSym on compositions: the
  first structures here with a _coproduct_, an antipode, and the compatibility that ties
  them to the product.
- [**Group algebras**](/docs/groupalgebra/group-algebras) — k[G] for cyclic, dihedral and product
  groups, where the interesting part is the centre: a commutative subalgebra spanned by
  class sums, one per conjugacy class.

## Groups, words and knots

- [**The modular group**](/docs/modular/modular-group) — PSL(2,Z) as a free product, its words as
  continued fractions, and its closed geodesics as binary necklaces — which, by Ghys's
  theorem, are knots in the complement of a trefoil.
- [**Knots and braids**](/docs/braid/knots-and-braids) — the Artin presentation, closures, the Burau
  representation and Alexander polynomials, and the Lorenz braids that turn a modular
  geodesic into an actual knot.

## Not here

How an expression is **written** and what it comes back out **as** — LaTeX, MathJSON,
Wolfram, NumPy, the shader languages — is reference material, not a walkthrough:
see [formats](/reference/formats/). The components these pages are built from have
their own [reference](/reference/component/), and the
[playground](/docs/components/overview) exercises each one in isolation.

The analytic special functions — Hurwitz zeta, the Lerch transcendent, the polylog and
polygamma of `@enumeratio/analytic` — are turned over with sliders rather than explained
at length, in the [explorations](/explore/). Running any of this outside a browser is the
[command line](/docs/cli/)'s job.
