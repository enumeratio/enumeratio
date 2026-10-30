---
name: Permutation
domain: Collections
signature: Permutation(list)
summary: The singular-inhabitant constructor for a permutation, as a one-line word.
references:
  - system: wikipedia
    identity: Permutation
  - system: mathworld
    identity: Permutation
stub: carrier
catalogCarrier: true
glyph: permutation
signatures:
  - call: Permutation(list)
    description: The singular-inhabitant constructor for a permutation, as a one-line word.
    library: enumeratio-combinatorics
    type: ((list<integer>) -> permutation) & ((cycle_decomposition) -> permutation) & ((subexcedant_seq) -> permutation)
---

- Ordered by the right weak order, the convention of Sage's `permutohedron_lequal`: p is below q when p's inversion set, the pairs of values a < b with b first, lies inside q's. A lattice, so `Min` is the meet and `Max` the join; `Compare` gives NaN for incomparable permutations.
