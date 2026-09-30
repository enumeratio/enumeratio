# @enumeratio/evaluation

Controlling evaluation over `@cortex-js/compute-engine`: cancellable evaluation, cooperative
deadlines, a memory cap enforced only where enforcement is real, and a Wolfram-style
`VerificationTest`. The main entry stays small and side-effect-free; `./node` and
`./browser` each add an isolated, hard-killable evaluator and a reusable worker pool on top,
kept out of the main entry so a browser bundle never pulls in `node:worker_threads` and a
Node bundle never pulls in `Worker`/`self`.

## Main entry

`declareEvaluation(ce)` declares three CE heads:

- [`TimeConstrained`](https://enumeratio.dev/reference/symbol/TimeConstrained)`(expr, t, failexpr?)` —
  held evaluation of `expr` under a `t`-second deadline (`ce.withTimeLimit` plus a checkpoint
  every cooperative loop honors), returning `failexpr` (or `Aborted`) on timeout. Both the
  sync and async routes are covered.
- [`MemoryConstrained`](https://enumeratio.dev/reference/symbol/MemoryConstrained)`(expr, bytes, failexpr?)` —
  in-process there is no way to cap a synchronous computation's heap, so this stays
  unevaluated and emits a message saying so; it is only real inside `evaluateIsolated`
  (`./node`), where the worker's own `resourceLimits` enforce it.
- [`VerificationTest`](https://enumeratio.dev/reference/symbol/VerificationTest)`(input, expected?, SameTest -> f, TimeConstraint -> t, MemoryConstraint -> b, TestID -> "…")` —
  runs `input` under those constraints and compares it against `expected`, returning a
  `TestResultObject` (`Outcome`, `Input`, `ExpectedOutput`, `ActualOutput`,
  `AbsoluteTimeUsed`, optional `TestID`).

`evaluate(ce, expr, { signal })` is a plain cancellable promise over
`expr.evaluateAsync({ signal })`, for a caller that wants to abort a stale run without a
worker.

```ts
import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareEvaluation } from "@enumeratio/evaluation";

const ce = new ComputeEngine();
declareEvaluation(ce);

ce.box(["TimeConstrained", ["Add", 1, 2], 5]).evaluate().json; // 3
ce.box(["TimeConstrained", SLOW, 0.02]).evaluate().json; // "Aborted"
```

## `./node`

`evaluateIsolated(json, { timeMs?, memoryBytes? })` runs one expression in a pooled
`worker_threads` worker: the cooperative deadline is tried first, and a hard `terminate()`
only ever catches a tight, uncooperative loop the cooperative path couldn't reach. This is
where `MemoryConstrained` is actually enforced. `createEvaluatorPool` exposes the pool
directly for a caller managing its own workers, and `openSession()` returns a `Session`
whose `evaluate()` calls share one worker's bindings — `:=` assignments persist across
calls until the worker is reset.

```ts
import { evaluateIsolated, openSession } from "@enumeratio/evaluation/node";

await evaluateIsolated(["Add", 2, 3]); // 5
await evaluateIsolated(slowLoop, { timeMs: 50 }); // "Aborted"

const session = openSession();
await session.evaluate(["Assign", "a", 5]); // { value: 5, reset: false }
await session.evaluate(["Power", "a", 2]); // { value: 25, reset: false }
session.close();
```

## `./browser`

The same shape over a dedicated `Worker` (`evaluateInWorker`, `createEvaluatorPool`), with
`openSession()` preferring a `SharedWorker` so multiple tabs can join one session. Memory is
only best-effort here: a browser gives a worker no memory cap to set, so `probeMemoryBytes`
polls the _page's_ memory and the host terminates the worker past the bound — not a
per-worker reading, so treat it as a heuristic, not an enforced limit.

## See also

[`@enumeratio/manifest`](../../../manifest) supplies this package's declared-heads summaries
(`SUMMARIES`) used in `TimeConstrained`/`MemoryConstrained`/`VerificationTest`'s
descriptions.
