---
name: Conjugate
domain: Compute engine
signature: "Conjugate(T) -> T where T: number"
summary: Complex conjugate of a number, or the pointwise conjugate of a function.
signatures:
  - call: "Conjugate(T) -> T where T: number"
    description: as compute-engine declares it
  - call: "Conjugate(T) -> T where T: number"
    description: Complex conjugate of a number, or the pointwise conjugate of a function.
    library: enumeratio-hypercomplex
    type: (value) -> value
    overrides: enumeratio-analytic
  - call: Conjugate(x)
    description: holds when x isn't known to be a number, so `Conjugate(Transpose(m))` stays unevaluated instead of a type error.
    library: enumeratio-analytic
    type: (value) -> value
    overrides: compute-engine
catalog:
  - system: findstat
    identity: Mp00041
    url: https://www.findstat.org/Mp00041
    on: Composition
  - system: findstat
    identity: Mp00202
    url: https://www.findstat.org/Mp00202
    on: IntegerPartition
  - system: sage
    identity: "Partitions(n).map(lambda p: p.conjugate())"
    url: https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/partition.html
    note: real running construction, not just the bare Partition.conjugate property; verified live n=4 term-for-term against integer_partitions' own conjugate map
    on: IntegerPartition
stub: engine
mapOn:
  - Composition
  - CorePartition
  - IntegerPartition
names:
  wolfram: Conjugate
bindings:
  - origin: mapped
    form: sympy
    template: conjugate($1)
    arity: 1
    threadArg: 1
    checked:
      version: 1.14.0
      on: 2026-10-14
    note: The complex conjugate only; the record's mapOn partition meanings have no SymPy counterpart.
  - origin: mapped
    form: mpmath
    template: conj($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: sage
    template: conjugate($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: "10.9"
      on: 2026-10-16
  - origin: mapped
    form: julia
    template: enumeratio_ball(conj, $1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
---
