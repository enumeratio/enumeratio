import { afterAll, expect, it } from 'vitest'
import { provideDb, makeDb, evaluateExpression, expressionExamples, close } from '@enumeratio/client'

// The expression-example battery (base_expression_example) IS a unit-test suite: every worked expression must
// evaluate to its recorded expected value through the same client path the explorer's evaluator uses.
provideDb(() => makeDb())
afterAll(() => close())

it('every expression example evaluates to its expected value', async () => {
  const examples = await expressionExamples()
  expect(examples.length).toBeGreaterThan(15)
  for (const ex of examples) {
    // ground-dependent carriers are pinned by the example file's header: ℤ/5ℤ, and ℂ2(ℤ/5) for multicomplex
    const ground = ex.carrier === 'modular_residue' ? 5
      : ex.carrier === 'multicomplex' ? { modulus: 5, level: 2 }
      : undefined
    const { result, error } = await evaluateExpression(ex.carrier, ex.expr, ground)
    expect(error ?? result, `${ex.carrier}: ${ex.expr}`).toBe(ex.expected)
  }
})
