---
name: EisensteinG
domain: Special functions
signature: EisensteinG(k, tau)
summary: The un-normalized weight-$k$ Eisenstein series $G_k(\tau) = 2\zeta(k)\,E_k(\tau)$ over the upper half-plane, for even $k \geq 4$.
signatures:
  - call: EisensteinG(k, tau)
    description: the un-normalized weight-$k$ Eisenstein series $G_k(\tau) = 2\zeta(k)\,E_k(\tau)$, for even $k \geq 4$
    library: enumeratio-analytic
    type: (integer, number) -> number
bindings:
  - origin: mapped
    form: julia
    template: enumeratio_eisenstein($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
---
