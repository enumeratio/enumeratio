---
sidebar: false
aside: false
---

# Expression kitchen sink

Every worked example in the db's `base_expression_example`, live — each one a real
[`<enumeratio-expression>`](/develop/packages/components/expression) wrapped in
[`<enumeratio-assert>`](/develop/packages/components/assert). So this page is **itself a full-stack unit-test run**: the
same battery the CLI's `expression-examples.test.ts` checks in Node, here evaluated in a real browser through the
actual web component and pglite. The scoreboard at the top should read *all passing*.

Filter by tag (`identity`, `edge-case`, `singleton`, `precedence`, `norm`). New examples added to the seed show up
here automatically — add more, and the coverage grows.

<ClientOnly>
  <ExpressionExamples />
</ClientOnly>

---

Want just the singletons — bare element literals that parse and render back? Filter to **`singleton`** above, or see
the [parsing a singleton element](/develop/packages/components/expression#parsing-a-singleton-element) section.
