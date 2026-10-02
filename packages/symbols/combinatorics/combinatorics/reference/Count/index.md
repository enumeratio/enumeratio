---
name: Count
domain: Collections
signature: Count(collection, value)
summary: The number of elements equal to value in the collection.
signatures:
  - call: Count(collection, value)
    description: the number of elements equal to `value`.
  - call: Count(QuotientRing(Integers, m))
    description: $m$ exactly, past $2^{53}$ too (the quotient-ring-collection patch).
    library: enumeratio-residues
    type: (collection<any>, any?) -> infinity | integer
    overrides: compute-engine
  - call: Count(collection, value, level)
    description: matches counted down to `level` (levels 1 through `level`), or — with `level` written as $\{level\}$ — at that level only.
    library: enumeratio-combinatorics
    type: (collection<any>, any?) -> infinity | integer
    overrides: enumeratio-residues
seeAlso:
  - Length
  - IndexOf
names:
  wolframIdentity: true
---

- A value absent from the collection counts as 0.
- A lazy family's count past $2^{53}$ comes back as the exact integer, when its kernel counts in bigint.
- Tests exact equality against a fixed value — not a Wolfram-style typed pattern like `_Integer`.
- See [[Length]] for the total element count, and [[IndexOf]] for a single matching position.
- A bare integer level spec counts matches at every level from 1 through it; $\{level\}$ counts that level only.
