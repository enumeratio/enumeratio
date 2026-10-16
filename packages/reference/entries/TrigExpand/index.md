---
name: TrigExpand
domain: Compute engine
signature: TrigExpand(value) -> value
summary: "Expand trigonometric and hyperbolic functions of sums and integer multiples of angles. Example: TrigExpand(sin(a+b)) → sin(a)cos(b) + cos(a)sin(b), TrigExpand(sin(2x)) → 2 sin(x) cos(x)"
signatures:
  - call: TrigExpand(value) -> value
    description: as compute-engine declares it
stub: engine
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sage
    template: SR($1).trig_expand()
    arity: 1
    threadArgOnly: 1
    checked:
      version: "10.9"
      on: 2026-10-16
---
