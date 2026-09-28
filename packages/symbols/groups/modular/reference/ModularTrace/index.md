---
name: ModularTrace
domain: The modular group
signature: ModularTrace(matrix)
summary: The trace of a matrix in $\mathrm{PSL}(2,\mathbb{Z})$.
signatures:
  - call: ModularTrace(matrix)
    description: $a+d$
    library: enumeratio-modular
    type: (expression<ModularMatrix> | list | string) -> integer
seeAlso:
  - ModularKind
  - ModularMatrix
bindings:
  - origin: mapped
    form: wolfram
    counterpart: false
    note: A plain matrix's trace is Wolfram's own Tr[{{a,b},{c,d}}], but this head also accepts an LR word directly and a chain of ModularMatrix/ModularSTWord calls -- the same word/matrix duality ModularMatrix's own entry notes Wolfram has no heads for, so the whole head is left unmapped rather than covering only the plain-matrix call shape. Wolfram Function Repository searched (modular group / PSL2Z / trace); only ModularTessellation turned up, an unrelated upper-half-plane drawing tool.
    checked:
      version: 15.0.0
      on: 2026-09-28
---
