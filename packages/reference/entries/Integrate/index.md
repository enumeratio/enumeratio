---
name: Integrate
domain: Compute engine
signature: Integrate(f, limits+)
summary: The symbolic integral of an expression, with optional bounds.
signatures:
  - call: Integrate(f, limits+)
    description: Adds a closed form for $\int \sin^m(u)\cos^n(u)\,dx$ with a linear argument $u = ax+b$ and $m$ or $n$ odd, expanding the odd power through $\sin^2+\cos^2=1$ into a polynomial antiderivative. Under `N`, over a semi-infinite interval, an oscillatory integrand that isn't finite at the finite end has its first lobe integrated without evaluating it there, where compute-engine drops the sliver next to the end; lobes that beat leave the integral unevaluated. Falls back to compute-engine's native integrator otherwise.
    library: enumeratio-analytic
    type: (function, limits+) -> list<number> | list<tuple> | number | tuple
    overrides: compute-engine
attributes:
  - HoldAll
---
