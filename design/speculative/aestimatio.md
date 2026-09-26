# aestimatio — controlling evaluation

Split from design/aestimatio.md: §5 Later, plus the `SharedWorker` forward-look
that was in §3's Browser bullet.

## Later

- A `SharedWorker` session that holds a notebook's engine across tabs (the browser
  isolated evaluator today is one worker per call).
- Running our own test suites inside a notatio evaluation process — per-test time and memory
  constraints, as the oracle scans already are (roadmap).
- `AbsoluteTiming`, `CheckAbort`, and evaluation history (`In`/`Out`) where a notebook needs it.
