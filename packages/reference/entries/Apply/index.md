---
name: Apply
domain: Compute engine
signature: Apply(f, args*)
summary: Apply a function to a list of arguments.
signatures:
  - call: Apply(f, args*)
    description: Recognizes `Apply(DifferenceRoot(…), n)` and evaluates the n-th term directly by running the recurrence forward in exact arithmetic from its initial conditions, rather than leaving the application symbolic; every other call falls through to compute-engine's native `Apply`.
    library: enumeratio-analytic
    type: "(name: any, arguments: any*) -> unknown"
    overrides: compute-engine
  - call: Apply(f, args*)
    description: the operator forms of Map, Fold and Filter, so Map(f)(xs) is Map(f, xs). A Function literal binds its arguments by renaming, so one can't capture them, and a sum, product or power called on an argument stays a call, as in Wolfram.
    library: enumeratio-combinatorics
    type: "(name: any, arguments: any*) -> unknown"
    overrides: enumeratio-analytic
  - call: Apply(process, t)
    description: a random process called at a time is its slice distribution, so WienerProcess()(t) is NormalDistribution(0, Sqrt(t)).
    library: enumeratio-statistics
    type: "(name: any, arguments: any*) -> unknown"
    overrides: enumeratio-combinatorics
seeAlso:
  - DifferenceRoot
---

[[DifferenceRoot]] documents the examples: what this adds needs a head a bare compute-engine lacks, so there is nothing to set beside its own `Apply`.
