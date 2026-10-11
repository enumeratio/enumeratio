---
name: SetterBox
domain: Boxes
signature: SetterBox(binding, domain, shown, options)
summary: One button, pressed when the variable holds its entry; a `SetterBar` is a row of them.
signatures:
  - call: SetterBox(binding, domain, shown, options)
    description: One button, pressed when the variable holds its entry; a `SetterBar` is a row of them.
    library: enumeratio-boxes
    type: (expression, expression, boxes, expression*) -> boxes
seeAlso:
  - RadioButtonBox
  - PopupMenuBox
  - TogglerBox
names:
  wolframIdentity: true
---

- Wolfram's `SetterBar` is a `GridBox` row of these, one per entry. The domain is the one value, as `[a]`, and the third argument is the box the button shows, as `SetterBox[Dynamic[c], {a}, label]` in Wolfram. A `Setter` over a whole list is one value there, `{{a, b, c}}`; here the list is the entries of a bar.
- A `TogglerBar` is the same row over `Dynamic(MemberQ(x, a))`: pressing a button puts its entry in the list `x` or takes it out.
- A reader of the controls (the keyboard driver, `reduce`, the terminal drawer) groups a row that shares a binding back into the one `SetterBar` or `TogglerBar`, so each variable has one control.
- Its intent is a choice.
