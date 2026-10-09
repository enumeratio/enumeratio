---
name: RadioButtonBox
domain: Boxes
signature: RadioButtonBox(binding, domain, options)
summary: One radio button, on when the variable holds its entry; a `RadioButtonBar` is a row of them.
signatures:
  - call: RadioButtonBox(binding, domain, options)
    description: One radio button, on when the variable holds its entry; a `RadioButtonBar` is a row of them.
    library: enumeratio-boxes
    type: (boxes, expression, expression*) -> boxes
seeAlso:
  - SetterBox
  - PopupMenuBox
  - TogglerBox
names:
  wolframIdentity: true
---

- Wolfram lowers a `RadioButtonBar` to a row of these, each beside a `TextBox` or other box holding its label. The domain is the one entry, as `[a]` (`[Labeled(a, "label")]` shows another label).
- A reader of the controls (the keyboard driver, `reduce`, the terminal drawer) groups a row of them that share a binding back into the one `RadioButtonBar`, so each variable has one control.
- Its intent is a choice.
