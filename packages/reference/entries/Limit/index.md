---
name: Limit
domain: Compute engine
signature: Limit(f, point, direction?)
summary: The limit of $f$ as its argument approaches $point$, optionally from one side.
signatures:
  - call: Limit(f, point)
    description: $\lim_{x \to point} f(x)$, the two-sided limit.
    type: "(function, point: number, direction: number?) -> number"
  - call: Limit(f, point, direction)
    description: the one-sided limit, approaching $point$ from above ($direction > 0$) or below ($direction < 0$).
seeAlso:
  - D
  - Sum
names:
  wolframIdentity: true
---

- $f$ is a function value (`Function(...)`), not a bare expression with a free variable.
