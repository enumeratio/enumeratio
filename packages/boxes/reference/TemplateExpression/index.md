---
name: TemplateExpression
domain: Boxes
signature: TemplateExpression("epsil")
summary: A hole in prose holding an expression's Epsil, filled by the environment it renders in.
signatures:
  - call: TemplateExpression("epsil")
    description: A hole in prose holding an expression's Epsil, filled by the environment it renders in.
    library: enumeratio-boxes
    type: (string, expression*) -> boxes
seeAlso:
  - TemplateSlot
---

- Markdown's `${…}` when what's inside isn't a bare name. The Epsil is kept as written; whoever fills the hole parses it. Wolfram's `TemplateExpression` holds the expression itself.
