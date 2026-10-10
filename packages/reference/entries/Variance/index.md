---
name: Variance
domain: Compute engine
signature: Variance((collection<any> | distribution | number)+) -> nan | real<0..>
summary: Sample variance of a collection of numbers.
signatures:
  - call: Variance((collection<any> | distribution | number)+) -> nan | real<0..>
    description: as compute-engine declares it
  - call: Variance((collection<any> | distribution | number)+) -> nan | real<0..>
    description: Sample variance of a collection of numbers.
    library: enumeratio-statistics
    type: ((collection<any> | distribution | number)+) -> nan | real<0..>
    overrides: compute-engine
names:
  wolframIdentity: true
stub: engine
bindings:
  - origin: mapped
    form: oscar
    template: (let v = $1, m = sum(v) // length(v); sum((x - m)^2 for x in v) // (length(v) - 1) end)
    arity: 1
---
