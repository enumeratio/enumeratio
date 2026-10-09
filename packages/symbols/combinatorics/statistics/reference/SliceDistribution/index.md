---
name: SliceDistribution
domain: Statistics
signature: SliceDistribution(proc, t)
summary: The ordinary distribution answering a random process's value at a fixed time $t$.
signatures:
  - call: SliceDistribution(proc, t)
    description: evaluates directly to the distribution [[WienerProcess]] or [[PoissonProcess]] answers at time $t$ — [[PDF]]/[[CDF]]/[[Mean]]/[[Variance]] need no changes of their own to reach it, since the slice IS already a plain [[NormalDistribution]] or [[PoissonDistribution]].
    library: enumeratio-statistics
    type: (any, any) -> distribution
seeAlso:
  - WienerProcess
  - PoissonProcess
  - RandomFunction
  - PDF
  - Mean
  - Variance
names:
  wolframIdentity: true
---

- `proc(t)`, Wolfram's `proc[t]`, is `SliceDistribution(proc, t)`: the call reads as the slice.
- $SliceDistribution(WienerProcess(\mu,\sigma), t) = NormalDistribution(\mu t, \sigma\sqrt{t})$; $SliceDistribution(PoissonProcess(\lambda), t) = PoissonDistribution(\lambda t)$.
- Unevaluated for any process kind other than WienerProcess/PoissonProcess — no other process is declared yet.
