---
name: StandardDeviation
domain: Compute engine
signature: StandardDeviation((collection<any> | distribution | number)+) -> nan | real<0..>
summary: Sample Standard Deviation of a collection of numbers.
signatures:
  - call: StandardDeviation((collection<any> | distribution | number)+) -> nan | real<0..>
    description: as compute-engine declares it
names:
  wolframIdentity: true
stub: engine
bindings:
  - origin: mapped
    form: sage
    template: std($1)
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
---
