---
name: CubeRoot
domain: Elementary functions
signature: CubeRoot(x)
summary: The real cube root of x.
signatures:
  - call: CubeRoot(x)
    description: the real cube root of x.
    library: "@enumeratio/analytic"
    type: (number) -> number
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sympy
    template: real_root($1, 3)
    arity: 1
    threadArg: 1
    checked:
      version: 1.14.0
      on: 2026-10-14
  - origin: mapped
    form: mpmath
    template: (-cbrt(-($1)) if im($1) == 0 and re($1) < 0 else cbrt($1))
    arity: 1
    threadArgOnly: 1
    note: The real cube root of a negative real, as ours; mpmath's cbrt is the principal root.
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: sage
    template: real_nth_root($1, 3)
    arity: 1
    threadArgOnly: 1
    checked:
      version: "10.9"
      on: 2026-10-16
  - origin: mapped
    form: julia
    template: enumeratio_cbrt($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
---

- Real-valued even at a negative x -- $\sqrt[3]{-27} = -3$, not a complex principal root. The same real branch as [[Root]]$(x, 3)$; CubeRoot is the named special case.
- Threads over a list, element-wise.
- An exact non-perfect-cube argument (like $\sqrt[3]{2}$) stays symbolic under plain evaluation; a floating-point argument, or N(), gives a decimal.
- A concretely complex argument is outside CubeRoot's real domain and is left unevaluated.
