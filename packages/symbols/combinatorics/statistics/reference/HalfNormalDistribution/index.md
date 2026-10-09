---
name: HalfNormalDistribution
domain: Statistics
signature: HalfNormalDistribution(theta)
summary: The half-normal distribution with parameter $\theta$ — $\sqrt{\pi/2}\,|Z|/\theta$ for a standard normal $Z$.
signatures:
  - call: HalfNormalDistribution(theta)
    description: "an inert distribution object — carries $\\theta$, unevaluated. Wolfram's own parameterization: $\\theta$ is inversely proportional to scale, not the scale itself."
    library: enumeratio-statistics
    type: (real<0..>) -> distribution
seeAlso:
  - ChiDistribution
  - NormalDistribution
  - PDF
  - CDF
names:
  wolframIdentity: true
---

- $PDF(x) = \frac{2\theta}{\pi}\, e^{-x^2\theta^2/\pi}$ for $x \geq 0$.
- $CDF(x) = Erf(x\theta/\sqrt{\pi})$ via [[Erf]], clamped to $0$ below $x=0$.
- $Mean = 1/\theta$, $Variance = (\pi-2)/(2\theta^2)$, both exact.
- [[RandomVariate]] samples $\sqrt{\pi/2}\,|Z|/\theta$ for a standard normal $Z$.
- $\theta=\sqrt{\pi/2}$ is the standard half-normal $|Z|$, the norm of one standard normal.
