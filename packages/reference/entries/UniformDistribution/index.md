---
name: UniformDistribution
domain: Compute engine
signature: UniformDistribution(real, real) -> expression<UniformDistribution>
summary: Continuous uniform distribution on the interval [a, b].
signatures:
  - call: UniformDistribution(real, real) -> expression<UniformDistribution>
    description: as compute-engine declares it
  - call: UniformDistribution(real, real) -> expression<UniformDistribution>
    description: Continuous uniform distribution on the interval [a, b].
    library: enumeratio-statistics
    type: ((list<real> | real)?, real?) -> expression<UniformDistribution>
    overrides: compute-engine
names:
  wolframIdentity: true
stub: engine
---
