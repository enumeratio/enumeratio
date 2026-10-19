---
name: MultiplicativeEnergy
domain: Collections
signature: MultiplicativeEnergy(A, B)
summary: 'The number of quadruples $(a_1,a_2,b_1,b_2)\in A\times A\times B\times B$ with $a_1b_1=a_2b_2$.'
signatures:
  - call: MultiplicativeEnergy(A, B)
    description: '$E^\times(A,B)=\#\{(a_1,a_2,b_1,b_2): a_1b_1=a_2b_2\}$, the pairs of pairs with equal products.'
    library: enumeratio-combinatorics
    type: (collection, collection?) -> integer
  - call: MultiplicativeEnergy(A)
    description: '$E^\times(A,A)$.'
    library: enumeratio-combinatorics
    type: (collection, collection?) -> integer
seeAlso:
  - AdditiveEnergy
  - Tally
  - Unique
catalog:
  - system: mathlib4
    identity: Finset.mulEnergy
    url: https://leanprover-community.github.io/mathlib4_docs/Mathlib/Combinatorics/Additive/Energy.html#Finset.mulEnergy
    note: "Finset.mulEnergy s t; mathlib takes any multiplicative Finset, ours exact rationals"
---

- Defined in Epsil as $\sum_x r(x)^2$, where $r(x)$ is the number of pairs $(a,b)\in A\times B$ with $ab=x$: [[AdditiveEnergy]] with products for sums.
- Zero is an ordinary member. It multiplies every member to $0$, so all of those pairs share the one product, which contributes $r(0)^2$: $\{0,1,2,3\}$ has $r(0)=7$.
- The members are the distinct members of the collection, as in mathlib's `Finset`: a list's repeats are ignored, and a [[Set]] reads like a list.
- Members must be exact rationals. A float, a symbol or an infinite collection leaves the call unevaluated.
- A geometric progression has the energy of an arithmetic one of the same length: $\{1,2,4,8,16\}$ and $\{0,\dots,4\}$ both give $85$. The primes are a multiplicative Sidon set, by unique factorization.
- Symmetric in its two arguments, and unchanged by scaling either set by a nonzero rational.
- Not a Wolfram, SymPy or Sage head.
