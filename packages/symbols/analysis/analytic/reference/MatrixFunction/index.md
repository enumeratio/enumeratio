---
name: MatrixFunction
domain: Linear algebra
signature: MatrixFunction(f, m)
summary: A scalar function f extended to a square matrix m, via its eigendecomposition. Provided by `@enumeratio/analytic`.
signatures:
  - call: MatrixFunction(f, m)
    description: f applied to the square matrix m, via its eigendecomposition.
    library: "@enumeratio/analytic"
    type: (function, matrix) -> matrix
seeAlso:
  - MatrixExp
  - MatrixPower
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sympy
    template: Matrix($2).analytic_func($1, Symbol("_mf")).applyfunc(simplify).tolist()
    arity: 2
    checked:
      version: 1.14.0
      on: 2026-10-21
    note: SymPy's `Matrix.analytic_func(f(x), x)` takes f as an expression of one variable, which the emitter builds from a head's name or a Function's body (an undefined name becomes an unknown function). It evaluates through the Jordan form, so it is the same function of the matrix; each entry is then simplified (the Lagrange form it builds for distinct eigenvalues is otherwise unreadable), so `Simplify` of a MatrixFunction is the call itself. A repeated eigenvalue's derivative comes back as a `Subs(Derivative(f(x), x), x, a)`. A constant f has no variable for it to use and is an error there.
---

- Exact where the structure gives one: a diagonal m (any size, including symbolic entries) reduces to elementwise f down the diagonal; f = Exp reduces to [[MatrixExp]] for any m; a 2×2 m otherwise reduces to Lagrange's formula at its two eigenvalues, with the Jordan-block limit f(λ)·I + f′(λ)·(M − λI) (f′ via compute-engine's own D) when they coincide.
- No general n×n closed form past that: a non-diagonal matrix larger than 2×2 needs a numerical-linear-algebra kernel (Parlett recurrence or a Schur form), which this does not implement -- those calls stay symbolic.
