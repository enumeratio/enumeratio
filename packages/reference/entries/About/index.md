---
name: About
domain: Compute engine
signature: About(x)
summary: What the system knows about a name, as a dictionary.
signatures:
  - call: About(x)
    description: as compute-engine declares it
  - call: About(x)
    description: compute-engine's entries, and the manifest's for a head not declared yet or a namespaced name
    library: enumeratio-evaluation
    type: (any) -> dictionary<any>
    overrides: compute-engine
seeAlso:
  - Head
attributes:
  - HoldAll
bindings:
  - origin: mapped
    form: wolfram
    counterpart: false
    note: Wolfram has no About; Information[Sin] is the nearest, and gives an InformationData object with its own keys (Usage, Attributes, Documentation), not a dictionary of these. A part of it isn't a part of About's.
    checked:
      version: 15.0.0
      on: 2026-10-01
---

A name is given as a symbol, `About(Zeta)`, or qualified, `About(ada.Sq)`. A string is a value, as
compute-engine has it: `About("Sin")` describes the string. Any other expression is described by
its kind and type.

compute-engine's keys come first: `name`, `kind`, `signature` or `type`, `description`,
`examples` (its definition's own), `keywords`, `attributes`, `wikidata`, `url`. Ours follow:

- `overloads`, every package's, most specific first; `params`, `defaults`, `documented` (the
  packages whose records document it) and `findstat`;
- for a library symbol, `namespace`, `pin`, `requires` and `head` (the head it's declared as).

A head no package has declared yet is described from the manifest: its `kind` and `signature`
are the ones it will have once declared, the overload no other replaces. A namespaced name is
described from its library's index, and never declared to answer.
