---
name: Variable
domain: Graphics
signature: Variable(domain, start, options...)
summary: "A declared variable's domain, starting value and hints, in a Variables option: the domain picks the control a hole showing it gets. Held as written."
signatures:
  - call: Variable(domain, start, options...)
    description: a variable ranging over domain, starting at start, with Where and Range hints
    library: enumeratio-formats
    type: (any*) -> any
attributes:
  - HoldAll
seeAlso:
  - Show
  - Labeled
---

`Variables -> [_d -> Variable(Integers, -5, Where -> IsSquareFree && !IsSquare, Range -> [-400, 400])]`
on an element declares `_d` for everything inside it: an integer starting at −5, stepping only
through squarefree non-squares, drawn at random from −400 to 400. A bare starting value, a domain
(`Integers`, `Reals`, `Booleans`) or a list of choices declares one without it.
