---
name: ComplexExpand
domain: Transformations
signature: ComplexExpand(expr)
summary: Split `expr` into real and imaginary parts, treating every free symbol as real. Provided by `@enumeratio/analytic`.
signatures:
  - call: ComplexExpand(expr)
    description: "`expr`, rewritten as `Re + i·Im` with its symbols assumed real."
    library: "@enumeratio/analytic"
    type: (expression) -> expression
seeAlso:
  - ExpToTrig
  - Re
  - Im
names:
  wolframIdentity: true
---

- Covers Add, Multiply, Negate, a nonnegative-integer Power, Sin, Cos, Sinh, Cosh, Exp and Abs of a complex argument, a power of a concrete complex base (`I^x` is $e^{i\pi x/2}$), the real and imaginary parts of a split, and a list entry by entry. Tan, Tanh, Ln and the other heads have no rule and fall through to "assumed real", which is wrong for them specifically.
- A concrete numeric argument with no free symbols needs none of this: plain evaluation already gives the same split (see the last example), so this is a no-op there.
