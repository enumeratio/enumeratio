---
name: PlanarPartitionAlgebra
domain: Oracle
signature: PlanarPartitionAlgebra(...)
summary: Mapped through to sage, oscar for the oracle; not yet written up here.
bindings:
  - origin: mapped
    form: sage
    template: PlanarAlgebra($1, enumeratio_delta, enumeratio_ring)
    arity: 1
  - origin: mapped
    form: oscar
    template: EnumeratioDiagramAlgebra(:planar, $1)
    arity: 1
stub: carrier
signatures:
  - call: PlanarPartitionAlgebra(...)
    description: Mapped through to sage, oscar for the oracle; not yet written up here.
    library: enumeratio-diagram
    type: (integer) -> diagram_algebra
---
