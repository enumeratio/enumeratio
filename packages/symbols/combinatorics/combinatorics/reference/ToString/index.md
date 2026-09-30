---
name: ToString
domain: Collections
signature: ToString(expr)
summary: expr printed as a string — of Epsil, this repo's own syntax, not Wolfram InputForm.
signatures:
  - call: ToString(expr)
    description: expr printed as Epsil source, via @enumeratio/engine's toInputForm
    library: enumeratio-combinatorics
    type: (any) -> string
seeAlso:
  - FromCharacterCode
names:
  wolframIdentity: true
---

- Prints Epsil, not Wolfram's InputForm: this repo has no Wolfram-syntax printer, and Epsil is InputForm's counterpart here — it round-trips through `parseExpression` the way InputForm round-trips through Wolfram's own parser.
- expr is evaluated first, then printed — same as Wolfram's own ToString.
