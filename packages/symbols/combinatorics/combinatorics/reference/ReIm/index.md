---
name: ReIm
domain: Collections
signature: ReIm(z)
summary: "{Re(z), Im(z)} — threads over a list the way Wolfram's Listable ReIm does."
signatures:
  - call: ReIm(z)
    description: the pair {Re(z), Im(z)}
    library: enumeratio-combinatorics
    type: (any) -> list<any>
seeAlso:
  - NumberQ
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: mpmath
    template: "[re($1), im($1)]"
    arity: 1
    threadArgOnly: 1
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: julia
    template: Any[enumeratio_ball(real, $1), enumeratio_ball(imag, $1)]
    arity: 1
    threadArgOnly: 1
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
---

- Listable: ReIm({z1, z2}) is {ReIm(z1), ReIm(z2)}, not a single flattened pair.
