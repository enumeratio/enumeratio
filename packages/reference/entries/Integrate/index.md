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
    overrides: enumeratio-evaluation
  - call: Integrate(f, limits+)
    description: The symbolic integral of an expression, with optional bounds.
    library: enumeratio-evaluation
    type: (function, limits+) -> list<number> | list<tuple> | number | tuple
    overrides: compute-engine
attributes:
  - HoldAll
bindings:
  - origin: mapped
    form: sympy
    template: integrate($1, $2)
    arity: 2
    checked:
      version: 1.14.0
      on: 2026-10-14
    note: A bare variable, or Limits(x, Nothing, Nothing), is an indefinite integral, which the scan compares up to a constant. An iterator is SymPy's (x, a, b).
  - origin: mapped
    form: sympy
    template: integrate($1, $2, $3)
    arity: 3
    checked:
      version: 1.14.0
      on: 2026-10-14
    note: The first limit is the outermost, as Wolfram's, so the iterators are emitted in reverse; SymPy integrates its first iterator innermost.
---
