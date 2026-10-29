---
name: SetAttributes
domain: Collections
signature: SetAttributes(f, attr)
summary: Turns on one of the Wolfram-named properties Attributes can report.
signatures:
  - call: SetAttributes(f, attr)
    description: Turns $attr$ on for $f$'s operator definition, in place.
    library: enumeratio-combinatorics
    type: (symbol, any) -> any
  - call: SetAttributes(f, {attr1, attr2, ...})
    description: Turns on several attributes at once.
    library: enumeratio-combinatorics
seeAlso:
  - Attributes
  - ClearAttributes
names:
  wolframIdentity: true
attributes:
  - HoldAll
---

- Only $\{Flat, HoldAll, Listable, Orderless\}$ can actually be turned on — see [[Attributes]] for why those four and no others. Declines (stays unevaluated) for an undeclared $f$, or any attribute name outside that set, rather than silently accepting a change that didn't happen.
- A declared head is `Protected`: `SetAttributes` leaves the call unevaluated and says `SetAttributes::write` (`Tag f in f is Protected.`), where Wolfram, whose `Protected` guards definitions rather than attributes, makes the change. Only a symbol of your own, defined first, takes attributes.
- Always returns $Nothing$, like Wolfram's own $Null$.
