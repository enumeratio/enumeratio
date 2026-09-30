---
name: Solve
domain: Compute engine
signature: Solve(equation, unknown?)
summary: The list of solutions of an equation, or a system of equations, for its unknown(s).
signatures:
  - call: Solve(equation, unknown)
    description: solves `equation` (an `Equal`, or a bare expression read as `= 0`) for `unknown`.
    type: (any, any*) -> list
  - call: Solve(equation)
    description: as above; the unknown defaults to the equation's single free variable, or to `x` when there are several and one of them is `x`.
  - call: Solve([eq1, eq2, …], [x, y, …])
    description: solves a system of equations; each solution is a tuple of values in the order of the variable list.
seeAlso:
  - Root
  - D
names:
  wolframIdentity: true
---
