---
name: LetterNumber
domain: Collections
signature: LetterNumber(c)
summary: A letter's 1-based position in the English alphabet -- a → 1, …, z → 26.
signatures:
  - call: LetterNumber(c)
    description: the 1-based alphabet position of a single character c (0 if not a letter)
    library: enumeratio-combinatorics
    type: (string, string?) -> integer | list<integer>
  - call: LetterNumber(s)
    description: a list, one position per character of string s
    library: enumeratio-combinatorics
names:
  wolframIdentity: true
---

- Case-insensitive -- LetterNumber("D") and LetterNumber("d") agree.
- The LetterNumber(c, alphabet) form is only answered for alphabet = "English"; any other named alphabet is left unevaluated.
