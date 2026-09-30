---
name: BinaryPalindromes
domain: Collections
signature: BinaryPalindromes(n)
summary: The binary words of length $n$ that read the same reversed.
signatures:
  - call: BinaryPalindromes(n)
    description: the binary words of length $n$ that read the same reversed
    library: enumeratio-combinatorics
    type: (integer<0..>) -> indexed_collection<binary_word>
seeAlso:
  - BinaryWords
  - PalindromicCompositions
catalog:
  - system: oeis
    identity: A016116
    url: https://oeis.org/A016116
    note: A016116(n+1) = 2^⌈n/2⌉
grades:
  - name: n
    role: axis
carrier: BinaryWord
---

- Count is $2^{\lceil n/2 \rceil}$.
