---
name: IsMachineNumber
domain: Collections
signature: IsMachineNumber(expr)
summary: Whether expr is an ordinary (not extended-precision) inexact number.
signatures:
  - call: IsMachineNumber(expr)
    description: $True$ for an inexact number carrying at most 15 significant decimal digits, $False$ otherwise (including every exact number).
    library: enumeratio-combinatorics
    type: (any) -> boolean
seeAlso:
  - IsNumeric
  - Precision
names:
  wolfram: MachineNumberQ
---

- Wolfram spells this `MachineNumberQ`; renamed to the `Is…` convention used across compute-engine predicates.
- Compute engine keeps no separate "machine" number representation — every inexact value is a decimal carrying as many digits as it was given — so this is approximated by digit count against Wolfram's ~15.95-digit `MachinePrecision`, documented as a divergence.
