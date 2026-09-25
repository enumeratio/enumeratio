# Verification

`VerificationTest(input, expected, …)` — `@enumeratio/aestimatio`'s reference-example
primitive (design/aestimatio.md §4). It evaluates `input` under the given constraints,
compares the result with `expected` (default: structural sameness), and returns a
`TestResultObject`: the outcome (`Success`, `Failure`, `Error` or `Aborted`), the input
and actual output, and how long it took. `<notatio-test-result-object>` draws it as an
In/Out pair with an outcome badge.

<Story
  title="Success">
<template #description>No mismatch, no message: a passing test just shows its In/Out.</template>
<notatio-cell value="VerificationTest(PowerModList(3, 1/2, 11), [5, 6])" />
</Story>

<Story
  title="Failure">
<template #description>The badge names what was expected; the Out line still shows what actually came back.</template>
<notatio-cell value="VerificationTest(PowerModList(3, 1/2, 11), [1, 2])" />
</Story>

<Story
  title="Aborted, under a time constraint">
<template #description>A 30-digit semiprime's factorization outruns a 0.05s <code>TimeConstraint</code>: the badge reads Aborted, and there is no Out line to show.</template>
<notatio-cell value="VerificationTest(FactorInteger(100000001000039100000310002511), [[100000000000031, 1], [1000000010000081, 1]], TimeConstraint -> 0.05)" />
</Story>

## Options

`SameTest`, `TimeConstraint`, `MemoryConstraint` and `TestID` are trailing rules,
Wolfram's way. `SameTest` takes any predicate of two arguments, applied instead of
structural sameness. `MemoryConstraint` is enforced only inside the isolated (worker)
evaluator — in-process, asking for one turns the test itself into an `Error` rather
than silently skipping the bound (see `@enumeratio/aestimatio`'s own comment on
`MemoryConstrained`).

<Story
  title="TestID">
<notatio-cell value='VerificationTest(2 + 2, 4, TestID -> "arithmetic-sanity")' />
</Story>

## In the browser: `evaluateInWorker`

`@enumeratio/aestimatio/browser` runs one evaluation in a plain dedicated `Worker` —
the browser counterpart of `@enumeratio/aestimatio/node`'s `evaluateIsolated`. A hard
time limit is a real `terminate()`; a memory limit is best-effort only, since a browser
gives a worker no memory cap to set — the host polls `performance
.measureUserAgentSpecificMemory()` (or Chromium's `performance.memory` where that isn't
available) and terminates once it reads past the bound. That reading is the _page's_
memory, not the worker's alone, so it is a guardrail, not the real per-process cap
`evaluateIsolated` gets from `worker_threads`' `resourceLimits`.

Wiring a live demo into this page (spinning up an actual `Worker` from the docs
bundle) is deferred past this PR — see `packages/symbols/evaluation/aestimatio/tests/browser.test.ts`
for `evaluateInWorker`'s host-side logic instead, exercised with a fake `Worker` so it
runs without a browser at all: a normal resolution, a `timeMs` kill, a `signal` abort,
and a `memoryBytes` bound tripped by an injected `measureMemory`.

## As a Vue component

<Story
  title="The Vue wrapper">
<TestResultObject outcome="Success" input="1 + 1" actual="2" time="0" />
</Story>
