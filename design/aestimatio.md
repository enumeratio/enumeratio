# aestimatio — controlling evaluation

compute-engine and our extensions are the nucleus: they say what an expression _means_ and
compute it. `@enumeratio/aestimatio` is the layer that decides **when** a computation runs,
**how long** and **how much memory** it may take, **whether it is cancelled**, and **whether
its answer checks out**. We computed fine without it; it exists so a page, a notebook or a
test run can put bounds on arbitrary input. Compilation is a sibling concern and will get its
own package.

Names follow Wolfram's where Wolfram has the concept (`TimeConstrained`, `MemoryConstrained`,
`VerificationTest`, `$Aborted`, `SameTest`, `TimeConstraint`, `MemoryConstraint`, `TestID`).

## 1. Cancellable evaluation

`evaluate(ce, expr, { signal })` returns a promise over compute-engine's
`evaluateAsync({ signal })`. An aborted signal rejects it; callers (a cell, a notebook re-run)
abort the previous run when their input changes, so stale work stops rather than merely being
discarded.

## 2. Deadlines, cooperatively

`TimeConstrained(expr, t, failexpr)` — `failexpr` defaults to `$Aborted`. Two routes:

- **sync** `evaluate` handler: `ce.withTimeLimit({ ms, label }, …)`; a `CancellationError`
  with `cause: "timeout"` from that span becomes `failexpr`.
- **async** `evaluateAsync` handler: the caller's signal combined with a timeout signal.

A deadline only interrupts code that looks at it. compute-engine's loops do; our bigint kernels
did not. `@enumeratio/boxed` therefore carries a small cooperative checkpoint — a deadline stack
set by `TimeConstrained` (and anyone else), and `checkpoint()` that throws when it has passed —
and the long loops in `@enumeratio/residues` (Pollard–Brent rho, baby-step giant-step, root
enumeration) call it. It lives in `boxed` so the kernels need no dependency on this package.

## 3. Isolation, for memory

JavaScript cannot cap the memory of a synchronous computation in its own process. So
`MemoryConstrained(expr, bytes, failexpr)` is enforced only when evaluation runs in an isolated
evaluator; in-process it stays unevaluated (said plainly, never silently ignored).

- **Node** (`@enumeratio/aestimatio/node`): `evaluateIsolated(json, { memoryBytes, timeMs,
setup })` runs one evaluation in a `worker_threads` Worker with `resourceLimits` sized from
  the constraint — a real heap cap — and `terminate()` as the hard time kill. `setup` names a
  module whose `configure(ce)` declares the libraries the host engine has, so the worker's
  engine means the same things.
- **Browser** (`@enumeratio/aestimatio/browser`): a plain `Worker`, `terminate()` for time,
  best-effort memory only (browsers expose no per-worker cap, so this polls the page's own
  memory instead — see `probeMemoryBytes`).

Both hosts evaluate through a worker pool (`createEvaluatorPool`): a worker that finished
cleanly is reused; one killed for time or memory, or errored, is replaced. Node keys idle
workers by memory limit, since `resourceLimits` are fixed at spawn. `evaluateIsolated` and
`evaluateInWorker` use a default pool.

A **session** (`openSession`) keeps one worker and one engine across calls, so `:=` bindings
survive from one evaluation to the next. A `timeMs` kill still terminates the worker; the
bindings are gone and that call's result says `reset: true`. In the browser a session prefers
a `SharedWorker` (tabs with the same `name` share it), falling back to a dedicated `Worker`.

Lessons carried from the archived async-engines design: `AbortSignal` from day one, and
`terminate()` is the only cancel that always works against a tight loop.

## 4. Verification

`VerificationTest(input, expected, SameTest -> f, TimeConstraint -> t, MemoryConstraint -> b,
TestID -> "…")` holds `input`, evaluates it under the constraints, compares with `expected`
(default: structural sameness) and returns a `TestResultObject` value carrying `Outcome`
(`"Success"`, `"Failure"`, `"Error"` — and `"Aborted"` when a constraint fired), `ActualOutput`,
`ExpectedOutput`, `AbsoluteTimeUsed` and `TestID`. It draws as a cell with an outcome badge.
Reference examples are, in effect, verification tests; they may be expressed this way later.

Future work (running our own test suites under aestimatio,
`AbsoluteTiming`/`CheckAbort`/evaluation history) moved to design/speculative/aestimatio.md.
