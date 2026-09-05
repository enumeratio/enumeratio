# `<enumeratio-assert>` — the testing harness

The trick that lets every page here be **both documentation and a browser test suite**. `<enumeratio-assert>` wraps a
value-bearing component, compares what it produced against an `expect`ed value, and lights up on a mismatch. Pair it
with `<enumeratio-assert-summary>` for a page-level scoreboard.

## How it works

Any component that emits a composed **`result`** `CustomEvent` (`{ value, error }`) can be wrapped — the client-backed
elements ([expression](/develop/packages/components/expression), [notation](/develop/packages/components/notation),
[figure](/develop/packages/components/figure)) all do. The assert catches that event as it bubbles through, so it reads the
value **generically**, without knowing which component it holds.

- **match** → quiet: a small `✓` (and, with `reveal="always"`, the live value beside it).
- **mismatch or error** → it lights up red and shows `expected X · got Y`, plus an optional failure `message`.
- **pending** → a muted `…` until the first result arrives (the in-browser db boots lazily).
- **not checked** → a muted `✎` and the live value, uncoloured — never pass or fail. This happens when there's
  nothing to check against: either **no `expect` was given** (a pure reflector — it just mirrors whatever the control
  evaluates, errors included), or the control was **edited off its default**, so the recorded expectation no longer
  applies. In the edited case it also offers a **reset** (`↺`) to restore the default. This is the important bit:
  once you type your own expression, the harness *can't* know the right answer, so it stops asserting instead of
  rubber-stamping a green ✓.

## `<enumeratio-assert>` attributes

| attribute | type | meaning |
|---|---|---|
| `expect` | string | the value the wrapped component should produce (compared trimmed). **Omit it** to make the wrapper a pure reflector — it shows the value, never pass/fail |
| `label` | string | a name for the row (also shown in the summary) |
| `message` | string | a custom line shown on failure, in place of the generic compare |
| `reveal` | `fail` \| `always` \| `never` | when to show the actual value — default `fail` (only on mismatch) |
| `no-reset` | boolean | suppress the built-in reset button (e.g. when the host lays out its own) |

## `<enumeratio-assert-summary>` attributes

| attribute | type | meaning |
|---|---|---|
| `label` | string | the noun in the tally (e.g. `expression examples`) |

It listens page-wide for every assert's status change and tallies pass / fail / pending — a live "test run" verdict.
Drop one near the top of a page; it sticks to the top as you scroll.

## Live

<enumeratio-assert-summary label="harness demos"></enumeratio-assert-summary>

A passing check and a deliberately failing one, side by side:

```html
<enumeratio-assert expect="5/6" reveal="always">
  <enumeratio-expression carrier="rational_number" expr="1/2 + 1/3"></enumeratio-expression>
</enumeratio-assert>
```

<p>
<enumeratio-assert expect="5/6" reveal="always" label="passes">
  <enumeratio-expression carrier="rational_number" expr="1/2 + 1/3"></enumeratio-expression>
</enumeratio-assert>
</p>

<p>
<enumeratio-assert expect="1" reveal="always" label="fails on purpose"
  message="1/2 + 1/3 is 5/6, not 1">
  <enumeratio-expression carrier="rational_number" expr="1/2 + 1/3"></enumeratio-expression>
</enumeratio-assert>
</p>

The summary above should read **1 failing** — one green, one red. That is the whole harness: a wrapper that turns a
demo into an assertion, and a scoreboard that turns a page of them into a test run.

### Edit it, and the check backs off

The passing demo above is editable — change the expression and the `✓` becomes a muted `✎` (the value, uncoloured)
with a `↺` reset, because the harness can't know the answer to *your* expression:

<p>
<enumeratio-assert expect="5/6" reveal="always" label="try editing me">
  <enumeratio-expression carrier="rational_number" expr="1/2 + 1/3"></enumeratio-expression>
</enumeratio-assert>
</p>

### No `expect` → a pure reflector

Drop `expect` entirely and it never asserts — it just mirrors whatever the control evaluates (errors included). Handy
as a plain live readout:

```html
<enumeratio-assert>
  <enumeratio-expression carrier="gaussian_integer" expr="(1 + i) * (1 + i)"></enumeratio-expression>
</enumeratio-assert>
```

<p>
<enumeratio-assert>
  <enumeratio-expression carrier="gaussian_integer" expr="(1 + i) * (1 + i)"></enumeratio-expression>
</enumeratio-assert>
</p>

## The relationship to the CLI tests

The [expression kitchen sink](/develop/packages/components/expression-examples) checks the **same**
`base_expression_example` rows the CLI's `expression-examples.test.ts` checks — one battery, two runners: `vitest` in
Node, and these assertions in a real browser through the actual web component and pglite.
