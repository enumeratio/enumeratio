# Connections to computer science

Many of enumeratio's collections are the **solution spaces of classic algorithmic problems** — several of them
NP-complete. The recurring shape: the *decision* problem ("does a solution exist?") can be hard, while the collection
*enumerates* the whole space, and grading it by a statistic is the **dynamic-programming table** the pseudo-polynomial
algorithm fills in. A generating function, seen this way, *is* a DP.

This page is the map; each touchpoint links to a detail page where one exists. It grows as connections are pinned
down and (ideally) turned into runnable demonstrations over the collections themselves.

## The touchpoints

- **[Subset sum & the partition problem](./subset-sum-and-q-binomials)** *(detail page)* — both NP-complete. The
  counting version is a generating function `∏(1+q^{wᵢ})`; for *consecutive* weights it collapses to the **Gaussian
  binomial** `\binom{N}{k}_q`, which is *also* k-subsets of `[N]` by sum and partitions in a box by size — the same
  sequence three ways. The structured (gap-free) case is easy; the general case is where the hardness lives. Verified,
  with an in-library assertion.

- **Maximum independent set** — NP-hard in general, linear on paths and cycles by DP. [`sparse_subsets`](/explore/collection/sparse_subsets) is the full
  set of independent sets of the path `Pₙ` (Fibonacci); [`independent_sets_cycle`](/explore/collection/independent_sets_cycle) is the same for the cycle `Cₙ`
  (Lucas). The collections *are* the solution spaces on the graph classes where the problem is tractable.

- **Hamiltonian path** — [`gray_codes`](/explore/collection/gray_codes) is an explicit Hamiltonian path on the hypercube `Qₙ`: successive length-n
  binary words differ in exactly one bit. A constructive solution to an in-general-NP-complete problem on a special
  graph.

- **Modular square roots ↔ factoring** — [`modular_residues`](/explore/collection/modular_residues) is ℤ/nℤ; extracting a square root modulo a composite `n`
  is computationally equivalent to factoring `n` (the hardness Rabin encryption rests on). A "square roots below a
  bound" trait/sub-collection is a natural thing to surface here. *(Candidate.)*

- **Sorting & the factorial number system** — [`permutations`](/explore/collection/permutations) is the space a comparison sort searches (`n!` orderings,
  `lg n! ≈ n lg n` comparisons); [`lehmer_codes`](/explore/collection/lehmer_codes) and [`subexcedant_seqs`](/explore/collection/subexcedant_seqs) are its mixed-radix (factorial-base) rank
  codes.

## The binary-number lens

A thread that ties several of these together: **a natural number, in binary, is a subset** (or multiset) via its
bit pattern. Sets without repeats ↔ no-two-adjacent-1s ↔ **Zeckendorf** ↔ [`sparse_subsets`](/explore/collection/sparse_subsets); the Calkin–Wilf /
hyperbinary correspondence ↔ how [`rational_numbers`](/explore/collection/rational_numbers) enumerates ℚ⁺. The [subset-sum detail
page](./subset-sum-and-q-binomials) develops this.

