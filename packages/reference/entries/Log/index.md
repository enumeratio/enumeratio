---
name: Log
domain: Elementary functions
signature: Log(z, b = 10)
summary: The logarithm of z in base b, defaulting to base 10.
signatures:
  - call: Log(z)
    description: the base-10 logarithm of z.
  - call: Log(z, b)
    description: the logarithm of z in base b.
  - call: Log(z, b = 10)
    description: The logarithm of z in base b, defaulting to base 10.
    library: enumeratio-analytic
    type: "(complex | infinity, base: (complex | infinity)?) -> number"
    overrides: compute-engine
seeAlso:
  - Ln
  - Log2
  - Log10
  - Lb
references:
  - system: wikipedia
    identity: Logarithm
  - system: mathworld
    identity: Logarithm
bindings:
  - origin: mapped
    form: sympy
    template: log($1, 10)
    arity: 1
    threadArg: 1
    checked:
      version: 1.14.0
      on: 2026-10-14
    note: compute-engine's one-argument Log is base 10, not the natural logarithm; SymPy's log takes the value first and then the base.
  - origin: mapped
    form: sympy
    template: log($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: 1.14.0
      on: 2026-10-14
  - origin: mapped
    form: mpmath
    template: log($1, 10)
    arity: 1
    threadArgOnly: 1
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: mpmath
    template: log($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: sage
    template: log($1, 10)
    arity: 1
    threadArgOnly: 1
    checked:
      version: "10.9"
      on: 2026-10-16
  - origin: mapped
    form: sage
    template: log($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: "10.9"
      on: 2026-10-16
  - origin: mapped
    form: julia
    template: enumeratio_ball(_log_base, $1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
  - origin: mapped
    form: julia
    template: enumeratio_ball(_log10, $1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
  - origin: mapped
    form: rust
    template: log10($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: rustc 1.98.1
      on: 2026-10-16
  - origin: mapped
    form: rust
    template: (ln($1) / ln($2))
    arity: 2
    threadArgOnly:
      - 1
      - 2
    note: "The quotient of natural logarithms: std has no logarithm to a base."
    checked:
      version: rustc 1.98.1
      on: 2026-10-16
---

- compute-engine's default base is 10, not $e$: Log(z) means $\log_{10}(z)$, and [[Ln]] is the natural logarithm.
- compute-engine's $\mathrm{Log}(z, b)$ takes the value first (value, then base) and defaults to base 10 in the one-argument form; for the natural logarithm use [[Ln]].
- Product rule: $\log_b(xy) = \log_b(x) + \log_b(y)$. Power rule: $\log_b(x^k) = k \log_b(x)$.
