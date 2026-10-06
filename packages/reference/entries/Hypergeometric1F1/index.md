---
name: Hypergeometric1F1
domain: Compute engine
signature: Hypergeometric1F1(complex | infinity, complex | infinity, complex | infinity) -> number
summary: Kummer confluent hypergeometric function ₁F₁(a; b; z) = M(a, b, z).
signatures:
  - call: Hypergeometric1F1(complex | infinity, complex | infinity, complex | infinity) -> number
    description: as compute-engine declares it
stub: engine
names:
  wolframIdentity: true
---

Kummer's confluent hypergeometric function $M(a,b,z) = {}_1F_1(a;b;z) = \sum_{k\ge0} (a)_k/(b)_k \cdot z^k/k!$ (DLMF 13.2.2) is entire in $z$ for every $a, b$ — the confluence of [[Hypergeometric2F1]]'s regular singular points at $1$ and $\infty$ into one irregular singular point at $\infty$, taking $z \to z/b$ and $b \to \infty$ in ${}_2F_1(a,b;c;z/b)$. It solves Kummer's equation $z w'' + (b-z) w' - a w = 0$; $U(a,b,z)$ (see [[HypergeometricU]]) is the equation's other standard solution. It is compute-engine's own native head, declared for real and complex $z$.

- $M(a,b,0) = 1$ for every $a, b$.
- Kummer's transformation: $M(a,b,z) = e^z\,M(b-a,b,-z)$ (DLMF 13.2.39).
- $M(1,2,2z) = e^z\sinh(z)/z$ (DLMF 13.6.2), so $M(1,2,z) = (e^z-1)/z$.
- $\operatorname{erf}(z) = \dfrac{2z}{\sqrt\pi}\,M(\tfrac12,\tfrac32,-z^2)$ (DLMF 7.11.4); see [[Erf]].
- $a$ a nonpositive integer terminates the series into a polynomial in $z$ of that degree, any $b$ not itself a nonpositive integer at or before that degree (where the denominator would divide by zero first).
