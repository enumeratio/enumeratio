---
name: Arctan2
domain: Compute engine
signature: "Arctan2(y: real | signed_infinity, x: real | signed_infinity) -> real"
summary: Two-argument arctangent giving the angle of a vector.
signatures:
  - call: "Arctan2(y: real | signed_infinity, x: real | signed_infinity) -> real"
    description: as compute-engine declares it
names:
  fungrim: Atan2
  wikidataConfirmed: true
bindings:
  - origin: mapped
    form: wolfram
    template: ArcTan[$2, $1]
    arity: 2
  - origin: mapped
    form: mpmath
    template: atan2($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: sage
    template: atan2($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: "10.9"
      on: 2026-10-16
stub: engine
---
