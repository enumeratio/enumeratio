---
name: CyclicGroup
domain: Wolfram
signature: CyclicGroup(...)
summary: Wolfram's own CyclicGroup, mapped through for the transpiler and the oracle but not yet written up here.
names:
  wolframIdentity: true
stub: carrier
bindings:
  - origin: mapped
    form: oscar
    template: enumeratio_cyclic(cyclic_group(PermGroup, $1), $1)
    arity: 1
  - origin: mapped
    form: sage
    template: enumeratio_cyclic($1)
    arity: 1
    note: "`CyclicPermutationGroup(n)`, its elements labeled by the powers of the n-cycle as ours are."
signatures:
  - call: CyclicGroup(...)
    description: Wolfram's own CyclicGroup, mapped through for the transpiler and the oracle but not yet written up here.
    library: enumeratio-groupalgebra
    type: (integer) -> expression<CyclicGroup>
---
