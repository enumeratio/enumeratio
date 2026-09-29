---
name: Union
domain: Collections
signature: Union(a, b, …)
summary: The set union of the argument collections, de-duplicated.
signatures:
  - call: Union(a, b, …)
    description: the de-duplicated union of the collections, as a $Set$.
  - call: Union(a, b, …)
    description: The set union of the argument collections, de-duplicated.
    library: enumeratio-combinatorics
    type: (any+) -> set
    overrides: compute-engine
seeAlso:
  - Intersection
  - SetMinus
names:
  wolframIdentity: true
---

- Duplicates within and across all the argument collections are removed; the result is returned as a $Set$.
- Commutative and idempotent: $A \cup A = A$, and argument order doesn't affect the result.
- Inclusion-exclusion: $|A \cup B| = |A| + |B| - |A \cap B|$. See [[Intersection]] and [[Length]].
- Sorted, matching Wolfram's Union — compute-engine's own de-duplication preserves first-seen order instead.
