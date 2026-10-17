---
name: Precision
domain: Collections
signature: Precision(expr)
summary: How many significant decimal digits a number carries.
signatures:
  - call: Precision(expr)
    description: $PositiveInfinity$ for an exact number, `MachinePrecision` for a machine number, otherwise its significant decimal digit count.
    library: enumeratio-combinatorics
    type: (any) -> integer<1..> | signed_infinity | real
seeAlso:
  - IsMachineNumber
  - IsNumeric
names:
  wolframIdentity: true
---

- Exact numbers (integers, rationals, radicals, symbolic constants like $\pi$) carry infinite precision, Wolfram's own convention.
- A literal of up to 17 digits (what a double holds) is a machine number: its precision is the symbol `MachinePrecision`, as in Wolfram.
- A literal with more digits counts the digits actually written; Wolfram's count is not an integer (`20.497` for 21 digits).
