---
name: FormBox
domain: Boxes
signature: FormBox(box, form)
summary: "Boxes in a form: `TeXForm` holds TeX as written, `StandardForm` or `TraditionalForm` formula boxes."
signatures:
  - call: FormBox(box, form)
    description: "Boxes in a form: `TeXForm` holds TeX as written, `StandardForm` or `TraditionalForm` formula boxes."
    library: enumeratio-boxes
    type: (boxes, symbol) -> boxes
seeAlso:
  - TextData
  - TemplateSlot
names:
  wolframIdentity: true
---

- A markdown `$…$` island is `FormBox(tex, TeXForm)`: never parsed or evaluated, typeset from its TeX. A hole in it makes the TeX a `RowBox` of fragments around the hole.
