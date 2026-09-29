---
name: RandomVariate
domain: Statistics
signature: RandomVariate(dist, n)
summary: A random draw from a distribution, or a list of them -- [[Random]] over the distribution, by its Wolfram name.
signatures:
  - call: RandomVariate(dist)
    description: one draw.
    library: enumeratio-statistics
    type: (any, integer<0..>?) random -> any
  - call: RandomVariate(dist, n)
    description: a list of $n$ draws.
    library: enumeratio-statistics
seeAlso:
  - SeedRandom
  - Distributed
names:
  wolframIdentity: true
---

- Seeded, not free-running — same convention as [[SeedRandom]]/`RandomInteger` in `@enumeratio/combinatorics/collections`: call [[SeedRandom]](seed) first for a reproducible sequence; without it, a fixed default seed makes even a bare call reproducible run to run. This file's draws are their OWN stream, independent of `RandomInteger`'s, even after the same [[SeedRandom]] call — a follow-up once collections' own seeded `RandomInteger` lands is to unify both under one engine-level generator.
- The generator is our own (mulberry32, the same algorithm `RandomInteger` uses), not Wolfram's — the same seed draws a different sequence. Only the shape and (for `NormalDistribution`/`UniformDistribution`/…) approximate range of the answer are guaranteed to match.
- Sampling method by distribution — [[NormalDistribution]]/[[BinormalDistribution]]: Box–Muller; [[UniformDistribution]]: inverse CDF; [[PoissonDistribution]]: Knuth's algorithm; [[BinomialDistribution]]: a sum of Bernoulli draws; [[GammaDistribution]]/[[BetaDistribution]]: Marsaglia–Tsang; [[EmpiricalDistribution]]: uniform resampling with replacement.
