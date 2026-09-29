---
name: ConnectedPermutations
domain: Collections
signature: ConnectedPermutations(n)
summary: "Indecomposable (connected) permutations of $\\{1, …, n\\}$: no proper prefix's values are exactly $\\{1, …, j\\}$."
signatures:
  - call: ConnectedPermutations(n)
    description: "Indecomposable (connected) permutations of $\\{1, …, n\\}$: no proper prefix's values are exactly $\\{1, …, j\\}$"
    library: enumeratio-collections
    type: (integer<0..>) -> indexed_collection<list<integer>>
seeAlso:
  - SymmetricGroup
references:
  - system: oeis
    identity: A003319
catalog:
  - system: oeis
    identity: A003319
    url: https://oeis.org/A003319
grades:
  - name: size
    role: axis
carrier: Permutation
---

- Count is A003319.
