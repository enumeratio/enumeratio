---
name: EvaluateForm
domain: The modular group
signature: EvaluateForm(form, x, y)
summary: The value of a [[QuadraticForm]] $ax^2+bxy+cy^2$ at the point $(x,y)$.
signatures:
  - call: EvaluateForm(form, x, y)
    description: $ax^2+bxy+cy^2$ at $(x,y)$
    library: enumeratio-modular
    type: (expression<QuadraticForm>, integer, integer) -> integer
seeAlso:
  - QuadraticForm
  - FormClassNumber
---
