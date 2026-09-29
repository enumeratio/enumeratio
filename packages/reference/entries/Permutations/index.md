---
name: Permutations
domain: Compute engine
signature: Permutations(xs, k?)
summary: Return all permutations of length k (default full length) of a collection.
signatures:
  - call: Permutations(xs, k)
    description: The permutations of length k (default full length) of a collection, as compute-engine declares it.
  - call: Permutations(n)
    description: 'The permutations of $\{1, \ldots, n\}$ as one-line words: the collection [[SymmetricGroup]](n).'
    library: enumeratio-combinatorics
    type: "((S, integer?) -> list<string> where S: string) & ((collection, integer?) -> list<list>) & ((integer<0..>) -> indexed_collection<permutation>)"
    overrides: compute-engine
seeAlso:
  - SymmetricGroup
references:
  - system: wikipedia
    identity: Permutation
  - system: mathworld
    identity: Permutation
  - system: rosettacode
    identity: Permutations
grades:
  - name: size
    role: axis
carrier: Permutation
---
