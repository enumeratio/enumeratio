---
name: PermutationPower
domain: Permutations
signature: PermutationPower(p, n)
summary: The $n$th power of a permutation under composition; a negative $n$ powers the inverse.
signatures:
  - call: PermutationPower(p, n)
    description: $p^n$, in the same notation as `p`
    library: enumeratio-groupalgebra
    type: (expression<Cycles> | list<integer>, integer) -> expression<Cycles> | list<integer>
  - call: PermutationPower(p, n)
    description: The $n$th power of a permutation under composition; a negative $n$ powers the inverse.
    library: enumeratio-combinatorics
    type: (expression<Cycles> | list<integer> | permutation, integer) -> expression<Cycles> | list<integer> | permutation
    overrides: enumeratio-groupalgebra
seeAlso:
  - PermutationProduct
  - InversePermutation
  - PermutationOrder
names:
  wolframIdentity: true
---

- Either notation or a `Permutation`, as [[PermutationProduct]] reads them; the result keeps the notation it was given
- $p^0$ is the identity, and $p^n$ is the identity whenever [[PermutationOrder]] divides $n$
- A non-integer exponent leaves the call unevaluated
