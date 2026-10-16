---
name: ModularLambda
domain: Wolfram
signature: ModularLambda(...)
summary: Wolfram's own ModularLambda, mapped through for the transpiler and the oracle but not yet written up here.
names:
  wolframIdentity: true
stub: carrier
signatures:
  - call: ModularLambda(...)
    description: Wolfram's own ModularLambda, mapped through for the transpiler and the oracle but not yet written up here.
    library: enumeratio-analytic
    type: (number) -> number
bindings:
  - origin: mapped
    form: julia
    template: enumeratio_ball(modular_lambda, $1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
---
