---
name: ReduceForm
domain: The modular group
signature: ReduceForm(form)
summary: Reduce an indefinite [[QuadraticForm]] by walking [[FormRho]] until Gauss's reduction condition holds.
signatures:
  - call: ReduceForm(form)
    description: the reduced form in its cycle
    library: enumeratio-modular
    type: (expression<QuadraticForm>) -> expression<QuadraticForm>
seeAlso:
  - FormRho
  - IsReducedForm
  - FormClassNumber
---
