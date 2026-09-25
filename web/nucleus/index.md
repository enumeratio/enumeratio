# nucleus

_nucleus_: the kernel of a nut. The part everything else is built around — where an
expression is **evaluated** and **compiled**, and where how long and how much it may take is
decided.

## The engine

The kernel is the [Cortex Compute Engine](https://cortexjs.io/compute-engine/): MathJSON as
the expression tree, boxed expressions over it, its language Epsil, and `evaluate`,
`simplify` and `N` as the verbs. Nothing above it replaces the engine; every head the
[mathematical core](/aestimatio/) defines is declared on it, and an expression means the same
thing in a page, a worksheet, the CLI and a test.

`@enumeratio/boxed` reads values back out of boxed expressions through checked accessors
rather than casts, and carries the cooperative checkpoint the long-running kernels call.

## Controlled evaluation

Arbitrary input needs bounds. The kernel decides **when** a computation runs, **how long**
it may take, **how much memory**, **whether it is cancelled**, and **whether its answer
checks out** — with Wolfram's names wherever Wolfram has the concept:

- **Cancellable evaluation** — a cell whose input changes aborts its previous run, so stale
  work stops rather than being thrown away when it finishes.
- **`TimeConstrained`** — a cooperative deadline, which compute-engine's loops and our
  bigint kernels both check.
- **`MemoryConstrained`** — enforced in an isolated evaluator: a worker thread with a real
  heap cap in Node, a dedicated or shared worker in the browser.
- **Sessions** — one worker and one engine kept across calls, so `:=` bindings survive
  from one evaluation to the next.
- **[`VerificationTest`](/playground/verification)** — a test is an expression, and its
  outcome a value.

These live today in the package `@enumeratio/aestimatio`, which predates this naming;
the package follows the name when its code is next reworked.

## Compilation

An expression is also a program. The code forms — `js`, `glsl`, `wgsl`, `numpy` — are real
compilation targets ([output formats](/reference/formats/output/)), and they are what lets a
page colour the complex plane one GPU invocation per pixel:
[ζ on the GPU](/explore/zeta/phase-portrait) is the whole Hurwitz kernel compiled to a WebGPU
shader. `@enumeratio/wolfram` transpiles to the Wolfram Language, as a target to check
against rather than to run on.

---

Built on by the [mathematical core](/aestimatio/), [the notation](/notatio/) and
[the catalogue](/enumeratio/).
