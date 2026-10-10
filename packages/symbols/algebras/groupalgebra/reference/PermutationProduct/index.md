---
name: PermutationProduct
domain: Permutations
signature: PermutationProduct(p, q, ...)
summary: The product of permutations, applying the left factor first. $(p\,q)(i) = q(p(i))$.
signatures:
  - call: PermutationProduct(p, q, ...)
    description: the permutation that applies `p`, then `q`, and so on
    library: enumeratio-groupalgebra
    type: ((expression<Cycles> | list<integer>)*) -> expression<Cycles> | list<integer>
  - call: PermutationProduct(p, q, ...)
    description: The product of permutations, applying the left factor first. $(p\,q)(i) = q(p(i))$.
    library: enumeratio-combinatorics
    type: ((expression<Cycles> | list<integer> | permutation)*) -> expression<Cycles> | list<integer> | permutation
    overrides: enumeratio-groupalgebra
seeAlso:
  - PermutationPower
  - InversePermutation
  - Permute
names:
  wolframIdentity: true
---

- Either notation, as [[Permute]] and [[InversePermutation]] read them: a one-line word `{v1, ..., vn}` or [[Cycles]], or a `Permutation`
- The result is [[Cycles]] when any argument is, else a one-line word (a `Permutation` when given one); shorter words are padded with fixed points
- Wolfram multiplies left to right, so `PermutationProduct(p, q)` is not $p \circ q$; it is $q \circ p$
- With no arguments it is the identity, `Cycles({})`
