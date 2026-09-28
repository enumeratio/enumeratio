---
name: PDF
domain: Compute engine
signature: PDF(distribution, real | signed_infinity) -> nan | real<0..>
summary: Probability density (continuous) or mass (discrete) function of a distribution, evaluated at x.
signatures:
  - call: PDF(distribution, real | signed_infinity) -> nan | real<0..>
    description: as compute-engine declares it
  - call: PDF(distribution, real | signed_infinity) -> nan | real<0..>
    description: Probability density (continuous) or mass (discrete) function of a distribution, evaluated at x.
    library: enumeratio-statistics
    type: (distribution, list<real> | real | signed_infinity) -> nan | real<0..>
    overrides: compute-engine
names:
  wolframIdentity: true
stub: engine
---
