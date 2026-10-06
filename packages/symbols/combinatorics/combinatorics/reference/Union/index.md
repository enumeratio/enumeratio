---
name: Union
domain: Collections
signature: Union(a, b, …)
summary: The union of the argument collections, sorted and de-duplicated; lists give a list, sets a set.
signatures:
  - call: Union(a, b, …)
    description: the sorted, de-duplicated union of the lists, as a $List$ (of sets, as a $Set$).
  - call: Union(a, b, …)
    description: The union of the argument collections, sorted and de-duplicated.
    library: enumeratio-combinatorics
    type: (any+) -> collection
    overrides: compute-engine
seeAlso:
  - Intersection
  - SetMinus
names:
  wolframIdentity: true
---

- Duplicates within and across all the argument collections are removed. Lists in give a list in Wolfram's canonical order (shorter sublists first); sets in give a set. With no arguments the result is $EmptySet$ (Wolfram's `Union[]` is the empty list).
- Commutative and idempotent: $A \cup A = A$, and argument order doesn't affect the result.
- Inclusion-exclusion: $|A \cup B| = |A| + |B| - |A \cap B|$. See [[Intersection]] and [[Length]].
- Sorted, matching Wolfram's Union — compute-engine's own de-duplication preserves first-seen order instead.
