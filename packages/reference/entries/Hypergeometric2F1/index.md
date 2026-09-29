---
name: Hypergeometric2F1
domain: Compute engine
signature: Hypergeometric2F1(complex | infinity, complex | infinity, complex | infinity, complex | infinity) -> number
summary: Gauss hypergeometric function ₂F₁(a, b; c; z).
signatures:
  - call: Hypergeometric2F1(complex | infinity, complex | infinity, complex | infinity, complex | infinity) -> number
    description: as compute-engine declares it
references:
  - system: wikipedia
    identity: Hypergeometric function
  - system: mathworld
    identity: HypergeometricFunction
  - system: dlmf
    identity: "15.2"
names:
  wikidata: Q21028472
stub: engine
---

The Gauss hypergeometric function ${}_2F_1(a,b;c;z) = \sum_{s\ge0} (a)_s(b)_s/(c)_s \cdot z^s/s!$ (DLMF 15.2.1) converges on the disc $|z| < 1$ and continues analytically elsewhere, with Euler's integral $\dfrac{\Gamma(c)}{\Gamma(b)\Gamma(c-b)}\int_0^1 t^{b-1}(1-t)^{c-b-1}(1-zt)^{-a}\,dt$ for $\operatorname{Re}(c) > \operatorname{Re}(b) > 0$ (DLMF 15.6.1); see [[Gamma]], [[Beta]]. It is the $p=2,q=1$ case of [[HypergeometricPFQ]], and dividing it by $\Gamma(c)$ gives [[Hypergeometric2F1Regularized]], entire in $c$ where this itself has poles. It is compute-engine's own native head, declared for real and complex $z$, including some continuation past $|z|=1$.

- ${}_2F_1(a,b;c;0) = 1$ for every $a, b, c$.
- $a$ or $b$ a nonpositive integer terminates the series into a polynomial in $z$.
- $c = b$ collapses to an elementary power: ${}_2F_1(a,b;b;z) = (1-z)^{-a}$ (DLMF 15.4.6).
- ${}_2F_1(1,1;2;z) = -z^{-1}\ln(1-z)$ (DLMF 15.4.1).
- The complete elliptic integral of the first kind: $K(k) = \dfrac{\pi}{2}\,{}_2F_1(\tfrac12,\tfrac12;1;k^2)$ (DLMF 15.9.24).
- Gauss's summation at $z=1$: ${}_2F_1(a,b;c;1) = \Gamma(c)\Gamma(c-a-b)/(\Gamma(c-a)\Gamma(c-b))$ for $\operatorname{Re}(c-a-b) > 0$ (DLMF 15.4.20).
