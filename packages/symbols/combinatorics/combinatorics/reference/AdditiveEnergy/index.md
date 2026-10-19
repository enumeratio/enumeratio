---
name: AdditiveEnergy
domain: Collections
signature: AdditiveEnergy(A, B)
summary: 'The number of quadruples $(a_1,a_2,b_1,b_2)\in A\times A\times B\times B$ with $a_1+b_1=a_2+b_2$.'
signatures:
  - call: AdditiveEnergy(A, B)
    description: '$E(A,B)=\#\{(a_1,a_2,b_1,b_2): a_1+b_1=a_2+b_2\}$, the pairs of pairs with equal sums.'
    library: enumeratio-combinatorics
    type: (collection, collection?) -> integer
  - call: AdditiveEnergy(A)
    description: '$E(A,A)$.'
    library: enumeratio-combinatorics
    type: (collection, collection?) -> integer
seeAlso:
  - MultiplicativeEnergy
  - Tally
  - Unique
catalog:
  - system: mathlib4
    identity: Finset.addEnergy
    url: https://leanprover-community.github.io/mathlib4_docs/Mathlib/Combinatorics/Additive/Energy.html#Finset.addEnergy
    note: "Finset.addEnergy s t; mathlib takes any additive Finset, ours exact rationals"
---

- Defined in Epsil as $\sum_x r(x)^2$, where $r(x)$ is the number of pairs $(a,b)\in A\times B$ with $a+b=x$: two pairs with the same sum are one quadruple, so tallying the $|A||B|$ sums is enough and the $|A|^2|B|^2$ quadruples are never tested.
- The members are the distinct members of the collection, as in mathlib's `Finset`: a list's repeats are ignored, and a [[Set]] reads like a list.
- Members must be exact rationals. A float, a symbol or an infinite collection leaves the call unevaluated, since a sum of floats would be tallied by rounding.
- At most $|A||B|\min(|A|,|B|)$, since a sum has at most that many representations, and a subgroup reaches $|A|^3$. A Sidon set has the least for its size, $2|A|^2-|A|$; large energy is what marks a set as additively structured.
- $E(\{1,\dots,n\})=(2n^3+n)/3$, and an arithmetic progression, translated or dilated, has the same energy.
- Symmetric in its two arguments, and unchanged by translating either set.
- Not a Wolfram, SymPy or Sage head. [[MultiplicativeEnergy]] is the same count for products.
