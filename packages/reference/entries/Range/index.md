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
  - origin: mapped
    form: mathlib4
    template: "(if ($3 : ℤ) ≠ 0 ∧ 0 ≤ (($2 : ℤ) - ($1 : ℤ)) * ($3 : ℤ) then (List.range (Int.natAbs (($2 : ℤ) - ($1 : ℤ)) / Int.natAbs ($3 : ℤ) + 1)).map (fun (k : ℕ) => ((($1 : ℤ) + ($3 : ℤ) * k : ℤ) : ℚ)) else ([] : List ℚ))"
    arity: 3
    note: stops before an end the step misses; empty when the step is 0 or points away from the end; integer endpoints and step only (a rational or decimal one fails to elaborate rather than rounding)
  - origin: mapped
    form: mathlib4
    template: "((List.range (Int.natAbs (($1 : ℤ) - 1) + 1)).map (fun (k : ℕ) => ((1 + Int.sign (($1 : ℤ) - 1) * k : ℤ) : ℚ)))"
    arity: 1
    note: Range(n) is Range(1, n), so it counts down from 1 when n is below 1; an integer n only
---
