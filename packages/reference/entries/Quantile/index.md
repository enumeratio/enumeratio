---
name: Quantile
domain: Compute engine
signature: Quantile(collection<any> | distribution, real<0..1>) -> nan | real | signed_infinity
summary: "Quantile (inverse CDF): the least x with CDF(x) ≥ p, for p in [0, 1]. The first argument may also be a data collection, in which case the empirical quantile is returned."
signatures:
  - call: Quantile(collection<any> | distribution, real<0..1>) -> nan | real | signed_infinity
    description: as compute-engine declares it
stub: engine
names:
  wolframIdentity: true
---
