---
name: Divides
domain: Compute engine
signature: Divides(integer, integer) -> boolean
summary: "`Divides(a, b)` returns `True` if `a` divides `b` (i.e. `b` is an integer multiple of `a`), corresponding to the notation `a ∣ b`. Both operands are integers; a symbolic operand keeps the relation unevaluated."
signatures:
  - call: Divides(integer, integer) -> boolean
    description: as compute-engine declares it
names:
  wolfram: Divisible
stub: engine
bindings:
  - origin: mapped
    form: mathlib4
    template: "(decide (($1 : ℤ) ∣ $2))"
    arity: 2
    note: Divisibility over the integers, zero included (0 divides only 0); a rational operand fails to elaborate.
  - origin: mapped
    form: julia
    template: iszero(mod(ZZ($2), ZZ($1)))
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
  - origin: mapped
    form: rust
    template: divides($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: num-integer 0.1.47
      on: 2026-10-16
---
