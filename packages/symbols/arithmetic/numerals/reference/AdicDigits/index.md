---
name: AdicDigits
domain: Numeral systems
signature: AdicDigits(x, count?)
summary: The digits of a [[AdicNumeral]] as a list, least significant first — the only order that lists something with no left end.
signatures:
  - call: AdicDigits(x, count?)
    description: the first `count` digits (default 20), least significant first
    library: enumeratio-numerals
    type: (value, integer?) -> list<integer>
seeAlso:
  - AdicExpansion
  - AdicNumeral
bindings:
  - origin: mapped
    form: sage
    template: list(($1).unit_part().expansion())[:$2]
    arity: 2
    note: A capped operand or x = 0 has no unit_part() in Sage; only exact non-zero x scans.
    checked:
      version: "10.9"
      on: 2026-09-28
---
