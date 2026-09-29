---
name: TemplateSlot
domain: Boxes
signature: TemplateSlot("name")
summary: A named hole in prose, filled by the environment it renders in.
signatures:
  - call: TemplateSlot("name")
    description: A named hole in prose, filled by the environment it renders in.
    library: enumeratio-boxes
    type: (string, expression*) -> boxes
seeAlso:
  - TemplateExpression
  - FormBox
names:
  wolframIdentity: true
---

- Markdown's `${name}`, in running text or inside a `$…$` island. Unfilled, it shows as written.
