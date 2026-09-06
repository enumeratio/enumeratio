# Generic species — two worked examples

The [Species as data](/learn/explorations/species) tour lays out the atoms, operations, and readings. This page is
its concrete companion: two objects defined *recursively* as species and then read for their counts — the same two
examples Sage's tutorial walks through in its
[Species section](https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/tutorial.html#section-generic-species),
but each backed by a live enumeratio collection instead of a REPL transcript.

The move both examples share is **recursion**: a species defined in terms of itself, `Y = F(X, Y)`, which
enumeratio solves the way Sage's `define` does — by iterating from the empty species until the coefficients
stabilise (`species_solve` / `ogf_solve`). It is the `fixpoint` operation (`Y=`) on the [op registry](/learn/explorations/species#the-operations).

## Example 1 — complete binary trees

A **binary tree** is either a leaf, or an internal node carrying an ordered pair of binary trees. As a species that
recurrence reads
$$ B = 1 + X \cdot B^2, $$
a leaf ($1$/$X$) *or* a node ($X$) splitting into a left and a right subtree ($B^2$). enumeratio stores exactly this
identity — `binary_trees` binds the species expression `1+X·Y^2`, solved as an OGF fixed point. Its isotype counts
are the **Catalan numbers**:
$$ C_0, C_1, C_2, \dots = 1, 1, 2, 5, 14, 42, 132, \dots $$

Sage builds the object with `BT.define(Leaf + (BT * BT))`, then asks for the isotypes at a fixed size and their
count. enumeratio *is* those isotypes — a real collection with drawable elements. There are $C_4 = 14$ trees at
size 4; here is one of them:

<enumeratio-figure collection="binary_trees" n="4" rank="6"></enumeratio-figure>

The generating series Sage extracts with `BT.isotype_generating_series()` is, here, the collection's own counting
sequence — `cardinality(binary_trees(n))` — certified against the $1 + X \cdot Y^2$ fixed point in the example
suite, and identified live as [OEIS A000108](https://oeis.org/A000108) on the collection's page. The unbounded
[`catalan_numbers`](/explore/collection/catalan_numbers) collection is the same species read as a number sequence
(the count-sequence reading).

## Example 2 — Fibonacci words

Sage's second example is the binary words with **no two consecutive 1s**, defined by a recurrence over the empty
and singleton species. enumeratio already has this object: [`sparse_subsets`](/explore/collection/sparse_subsets) —
a subset of $[n]$ with no two consecutive elements, equivalently a length-$n$ binary string with no `11`
(the independent sets of the path $P_n$). The recurrence, splitting on how a word ends, is
$$ \mathrm{FW} = \varepsilon + Z_0 \cdot \mathrm{FW} + Z_1 \cdot \varepsilon + Z_1 Z_0 \cdot \mathrm{FW}, $$
and its counts are the **Fibonacci numbers**: $|\mathrm{sparse\_subsets}(n)| = F(n+2)$,
$$ 1, 2, 3, 5, 8, 13, 21, \dots $$

The eight no-`11` words of length 4:

<enumeratio-figure collection="sparse_subsets" n="4" rank="0"></enumeratio-figure>

Where Sage identifies the sequence with a manual `oeis()` call, enumeratio surfaces it live: `sparse_subsets` counts
[OEIS A000045](https://oeis.org/A000045) (the Fibonacci numbers, offset), shown on its collection page alongside the
elements. The count is `fibonacci_term(n+2)` — the same Fibonacci engine [`fibonacci_numbers`](/explore/collection/fibonacci_numbers)
uses, reused rather than re-derived.

## What carried over, and what didn't

Both examples are the recursive/`define` core of Sage's generic-species section, made live. What enumeratio does
*not* reproduce here is Sage's lazy infinite series (`g[100]` on demand): a reading is evaluated to a finite degree,
not held as a lazy stream. The [Species as data](/learn/explorations/species) page covers the rest of the operation
vocabulary and the labelled ⇄ isotype reading distinction these two examples lean on.
