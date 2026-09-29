---
name: FromCharacterCode
domain: Collections
signature: FromCharacterCode(n) / FromCharacterCode({n1, n2, …})
summary: The character(s) with the given Unicode code point(s) — the inverse of ToCharacterCode.
signatures:
  - call: FromCharacterCode(n)
    description: the single character with code point n
    library: enumeratio-combinatorics
    type: (integer | list<integer>) -> string
  - call: FromCharacterCode({n1, n2, …})
    description: the string built from each code point, in order
    library: enumeratio-combinatorics
seeAlso:
  - ToCharacterCode
names:
  wolframIdentity: true
---

- Code points, not UTF-16 units — see [[ToCharacterCode]].
