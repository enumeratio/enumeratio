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

Both hosts route through a reusable worker pool (`createEvaluatorPool`, `./pool.ts`'s
host-agnostic core underneath): workers are checked out per call and either reused (finished
cleanly) or replaced — destroyed, a fresh one takes the slot — when killed for time or
memory, or otherwise errored. Node keys its idle lists by memory limit, since a worker's
`resourceLimits` are fixed at spawn; the browser has no such split. `evaluateIsolated` and
`evaluateInWorker` route through a lazily-created default pool, so the two keep their
existing one-call signatures while no longer paying a spawn per call. Idle Node pool workers
are `unref()`d so a short-lived process can still exit.

A **session** (`openSession`, both hosts) holds ONE worker and ONE `ComputeEngine` across
`evaluate` calls instead of one worker per call — for a notebook evaluating off its own
thread, where `:=` bindings need to survive from one cell to the next. A `timeMs` kill on a
runaway call still terminates the worker (the only reliable cancel against a tight,
uncooperative loop), but for a session that means the bindings made before it are gone: a
fresh worker with a fresh engine takes over, and that call's own result carries `reset:
true` rather than pretending nothing happened. On the browser, `openSession` prefers a
`SharedWorker` (tabs passing the same `name` join one engine and its bindings) and falls
back to a dedicated `Worker` where `SharedWorker` isn't available; a `SharedWorker`'s
`timeMs` can only give up locally (`reset` stays `false`) since there is no way from one tab
to safely kill a context other tabs may be using.

Lessons carried from the archived async-engines design: `AbortSignal` from day one, and
`terminate()` is the only cancel that always works against a tight loop.

## 4. Verification

`VerificationTest(input, expected, SameTest -> f, TimeConstraint -> t, MemoryConstraint -> b,
TestID -> "…")` holds `input`, evaluates it under the constraints, compares with `expected`
(default: structural sameness) and returns a `TestResultObject` value carrying `Outcome`
(`"Success"`, `"Failure"`, `"Error"` — and `"Aborted"` when a constraint fired), `ActualOutput`,
`ExpectedOutput`, `AbsoluteTimeUsed` and `TestID`. It draws as a cell with an outcome badge.
Reference examples are, in effect, verification tests; they may be expressed this way later.

## 5. Later

- Wiring a `DynamicModule`'s reactive/transcript evaluation through a session, so a
  notebook's cells run off its own thread with state that survives between them — not done
  yet, just left as the obvious next consumer of §3's `openSession`.
- Running our own test suites inside a notatio evaluation process — per-test time and memory
  constraints, as the oracle scans already are (roadmap).
- `AbsoluteTiming`, `CheckAbort`, and evaluation history (`In`/`Out`) where a notebook needs it.
- A test-suite runner (per §3's pool/session groundwork) is next.
