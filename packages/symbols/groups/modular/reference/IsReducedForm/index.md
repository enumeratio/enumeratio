---
name: IsReducedForm
domain: The modular group
signature: IsReducedForm(form)
summary: Whether an indefinite [[QuadraticForm]] satisfies Gauss's reduction condition, $|\sqrt D - 2|a|| < b < \sqrt D$.
signatures:
  - call: IsReducedForm(form)
    description: Gauss's reduction condition
    library: enumeratio-modular
    type: (expression<QuadraticForm>) -> boolean
seeAlso:
  - QuadraticForm
  - ReduceForm
  - FormClassNumber
---
