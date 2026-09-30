---
name: Arctan
domain: Elementary functions
signature: Arctan(x)
summary: Arctangent, the inverse of [[Tan]] restricted to $(-\pi/2, \pi/2)$.
signatures:
  - call: Arctan(x)
    description: the principal value $y \in (-\pi/2, \pi/2)$ with $\tan(y) = x$.
  - call: Arctan(x)
    description: Arctangent, the inverse of [[Tan]] restricted to $(-\pi/2, \pi/2)$.
    library: enumeratio-analytic
    type: (complex | signed_infinity | ~oo) -> Indeterminate | number
    overrides: compute-engine
seeAlso:
  - Tan
  - Arcsin
  - Arccos
references:
  - system: wikipedia
    identity: Inverse trigonometric functions
  - system: mathworld
    identity: InverseTangent
  - system: dlmf
    identity: "4.23"
names:
  fungrim: Atan
  dlmf: arctangent function
  wolfram: ArcTan
---

- Defined for every real x, unlike [[Arcsin]] and [[Arccos]].
- Odd function: $\arctan(-x) = -\arctan(x)$.
- Horizontal asymptotes at $\pm\pi/2$ as $x \to \pm\infty$.
- The two-argument atan2 form is a separate compute-engine function, $\mathrm{Arctan2}(x, y)$, rather than an overload of Arctan.
