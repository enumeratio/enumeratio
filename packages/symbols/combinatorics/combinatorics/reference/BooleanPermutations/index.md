---
name: BooleanPermutations
domain: Collections
signature: BooleanPermutations(n)
summary: The Boolean permutations of $\{1, …, n\}$ (Tenner) — those avoiding the patterns $321$ and $3412$ — as a lazy indexed family.
signatures:
  - call: BooleanPermutations(n)
    library: enumeratio-combinatorics
    description: the permutations of $\{1, …, n\}$ whose principal Bruhat order ideal is a Boolean lattice; equivalently, those avoiding $321$ and $3412$.
    type: (integer<0..>) -> indexed_collection<permutation>
enumerate:
  expr: BooleanPermutations(4)
  columns: Descents, Inversions
  glyph: permutation
seeAlso:
  - AdjacentTranspositionInvolutions
  - Fibonacci
  - Count
  - At
catalog:
  - system: oeis
    identity: A001519
    url: https://oeis.org/A001519
    note: "F(2n-1): 1, 1, 2, 5, 13, 34, …"
  - system: sage
    identity: Permutations(n, avoiding=[[3,2,1],[3,4,1,2]])
    url: https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/permutation.html
    note: verified n=1..6 (1, 2, 5, 13, 34, 89)
grades:
  - name: size
    role: axis
carrier: Permutation
---

- A lazy indexed collection; the count is $F(2n-1)$ — $1, 1, 2, 5, 13, 34, …$, A001519. See [[Fibonacci]].
- Tenner's characterisation: $\pi$ is Boolean when its principal Bruhat ideal $[e, \pi]$ is a Boolean lattice, equivalently when $\pi$ has a reduced word with no repeated generator, equivalently when $\pi$ avoids $321$ and $3412$.
- Contains [[AdjacentTranspositionInvolutions]], the Boolean permutations whose generators pairwise commute.
- Each element is the one-line word; $At$ enumerates all $n!$ permutations in lexicographic order and indexes into those avoiding both patterns, so it is practical only for small $n$; the count is exact for every $n$.
