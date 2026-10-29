---
name: Range
domain: Compute engine
signature: "Range(number, number?, step: number?) -> indexed_collection<number>"
summary: A sequence of numbers from a start to an end value with an optional step.
signatures:
  - call: "Range(number, number?, step: number?) -> indexed_collection<number>"
    description: as compute-engine declares it
names:
  wolframIdentity: true
stub: engine
bindings:
  - origin: mapped
    form: mathlib4
    template: "((List.range (Int.natAbs (($2 : ℤ) - $1) + 1)).map (fun (k : ℕ) => ((($1 : ℤ) + Int.sign (($2 : ℤ) - $1) * k : ℤ) : ℚ)))"
    arity: 2
    note: inclusive, counting down when the start is past the end; integer endpoints only (a rational endpoint fails to elaborate rather than rounding), read as rationals like the lane's lists
---
