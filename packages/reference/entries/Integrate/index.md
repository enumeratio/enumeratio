---
name: Integrate
domain: Compute engine
signature: Integrate(f, limits+)
summary: The symbolic integral of an expression, with optional bounds.
signatures:
  - call: Integrate(f, limits+)
    description: Adds a closed form for $\int \sin^m(u)\cos^n(u)\,dx$ with a linear argument $u = ax+b$ and $m$ or $n$ odd, expanding the odd power through $\sin^2+\cos^2=1$ into a polynomial antiderivative; falls back to compute-engine's native integrator otherwise.
    library: enumeratio-analytic
    type: (function, limits+) -> list<number> | number
    overrides: compute-engine
attributes:
  - HoldAll
---
