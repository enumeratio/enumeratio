---
name: SubexcedantSeq
domain: Collections
signature: SubexcedantSeq(list)
summary: The singular-inhabitant constructor for a subexcedant sequence, a word whose entry $i$ (from 1) lies in $0 \le a_i \le i - 1$.
catalogCarrier: true
signatures:
  - call: SubexcedantSeq(list)
    description: The singular-inhabitant constructor for a subexcedant sequence, a word whose entry $i$ (from 1) lies in $0 \le a_i \le i - 1$.
    library: enumeratio-combinatorics
    type: ((list<integer>) -> subexcedant_seq) & ((permutation) -> subexcedant_seq)
seeAlso:
  - SubexcedantSeqs
  - LehmerCodes
laws:
  - inverse: Permutation
---

- A [[SubexcedantSeqs]] element.
- `SubexcedantSeq(permutation)` is the permutation's inversion sequence: entry $i$ counts the earlier entries larger than the $i$-th. Its total is the inversion count, and `Permutation(sequence)` is the way back.
- The two enumerate in different orders, so the conversion is a bijection and not a rank-preserving one: [[SymmetricGroup]] runs its last two positions fastest, [[SubexcedantSeqs]] its last entry.
