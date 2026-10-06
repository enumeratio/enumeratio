---
name: AdjacentTranspositionInvolutions
domain: Collections
signature: AdjacentTranspositionInvolutions(n)
summary: The permutations of $\{1, …, n\}$ that are products of pairwise disjoint adjacent transpositions — every inversion $\pi(i) > \pi(j)$ has $j = i+1$ — as a lazy indexed family.
signatures:
  - call: AdjacentTranspositionInvolutions(n)
    library: enumeratio-combinatorics
    description: the permutations of $\{1, …, n\}$ whose inversions are all adjacent; the involutions that swap only neighbours.
    type: (integer<0..>) -> indexed_collection<permutation>
enumerate:
  expr: AdjacentTranspositionInvolutions(4)
  columns: Descents, Inversions
  glyph: permutation
seeAlso:
  - BooleanPermutations
  - Fibonacci
  - Count
  - At
catalog:
  - system: oeis
    identity: A000045
    url: https://oeis.org/A000045
    note: "F(n+1): no non-adjacent inversion (independent sets of a path)"
grades:
  - name: size
    role: axis
carrier: Permutation
---

- A lazy indexed collection; the count is $F(n+1)$ — $1, 1, 2, 3, 5, 8, …$, A000045. See [[Fibonacci]].
- Each permutation is a product of pairwise non-adjacent adjacent transpositions — a bijection with independent sets of the path graph on $\{1, …, n-1\}$, i.e. with a length-$(n-1)$ Fibonacci word. $At$ unranks that word and applies its transpositions to the identity.
- A subfamily of the Boolean permutations: [[BooleanPermutations]] (Tenner, avoiding $321$ and $3412$, counted by $F(2n-1)$) also allows adjacent transpositions $s_i s_{i+1}$ in either order; the two first differ at $n = 3$ (3 here against 5 there).
