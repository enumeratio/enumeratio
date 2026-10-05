---
name: EmpiricalDistribution
domain: Statistics
signature: EmpiricalDistribution(data)
summary: The distribution of the values actually observed in `data`.
signatures:
  - call: EmpiricalDistribution(data)
    description: an inert distribution object wrapping `data` (a list).
    library: enumeratio-statistics
    type: (list<real>) -> distribution
seeAlso:
  - Mean
  - Variance
  - RandomVariate
names:
  wolframIdentity: true
---

- [[PDF]]/[[CDF]] at $x$ are the observed PROPORTIONS — the count of `data` equal to (resp. at most) $x$, divided by its length. Wolfram's own `PDF` is a continuous, kernel-smoothed density; this is a discrete empirical measure instead, a documented divergence.
- [[Mean]] delegates to [[Mean]] of `data`; [[Variance]] is the population variance (divisor $n$), as in Wolfram, so it is $(n-1)/n$ of `Variance(data)`.
- [[RandomVariate]] resamples uniformly from `data`, with replacement.
