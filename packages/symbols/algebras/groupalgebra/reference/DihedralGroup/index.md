---
name: DihedralGroup
domain: Wolfram
signature: DihedralGroup(...)
summary: Wolfram's own DihedralGroup, mapped through for the transpiler and the oracle but not yet written up here.
names:
  wolframIdentity: true
stub: carrier
bindings:
  - origin: mapped
    form: oscar
    template: enumeratio_dihedral(dihedral_group(PermGroup, 2 * $1), $1)
    arity: 1
    note: Our DihedralGroup(n) is the symmetries of an n-gon; Oscar and GAP index dihedral groups by order, so it is dihedral_group(2n) there.
  - origin: mapped
    form: sage
    template: enumeratio_dihedral($1)
    arity: 1
    note: Sage's `DihedralGroup(n)` is the symmetries of an n-gon, order 2n on n points, as ours is. Elements are labeled `k` for a rotation and `sk` for a reflection.
signatures:
  - call: DihedralGroup(...)
    description: Wolfram's own DihedralGroup, mapped through for the transpiler and the oracle but not yet written up here.
    library: enumeratio-groupalgebra
    type: (integer) -> expression<DihedralGroup>
---
