---
name: CDF
domain: Compute engine
signature: CDF(distribution, real | signed_infinity) -> nan | real<0..1>
summary: Cumulative distribution function P(X ≤ x) of a distribution.
signatures:
  - call: CDF(distribution, real | signed_infinity) -> nan | real<0..1>
    description: as compute-engine declares it
  - call: CDF(distribution, real | signed_infinity) -> nan | real<0..1>
    description: Cumulative distribution function P(X ≤ x) of a distribution.
    library: enumeratio-statistics
    type: (distribution, list<real> | real | signed_infinity) -> nan | real<0..1>
    overrides: compute-engine
names:
  wolframIdentity: true
stub: engine
---
