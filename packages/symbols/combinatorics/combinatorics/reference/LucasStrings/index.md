---
name: LucasStrings
domain: Collections
signature: LucasStrings(n)
summary: CIRCULAR binary words of length $n$ with no two consecutive ones, wraparound included.
signatures:
  - call: LucasStrings(n)
    description: CIRCULAR binary words of length $n$ with no two consecutive ones, wraparound included
    library: enumeratio-combinatorics
    type: (integer<0..>) -> indexed_collection<binary_word>
seeAlso:
  - FibStrings
references:
  - system: oeis
    identity: A000032
catalog:
  - system: oeis
    identity: A000204
    url: https://oeis.org/A000204
grades:
  - name: n
    role: axis
carrier: BinaryWord
---

- Count is the Lucas numbers, with $n=0$ special-cased to $1$ (A000032).
