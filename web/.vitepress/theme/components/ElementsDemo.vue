<template>
  <ClientOnly>
    <div class="elements-demo">
      <section>
        <h4>&lt;notatio-cell&gt; -- notebook In/Out</h4>
        <notatio-cell value="1 / 2 + 1 / 3" />
      </section>
      <section>
        <h4>&lt;notatio-output&gt; -- read-only, evaluated LaTeX</h4>
        <notatio-output value="\sqrt{16}+2^3" format="latex" evaluate />
      </section>
      <section>
        <h4>&lt;notatio-output&gt; -- MathJSON</h4>
        <notatio-output value='["Add", ["Power", "x", 2], 1]' format="mathjson" />
      </section>
      <section>
        <h4>&lt;notatio-input&gt; -- editor</h4>
        <notatio-input value="x^2 + 1" />
      </section>
      <section>
        <h4>&lt;notatio-input readonly&gt; -- no editor loaded</h4>
        <notatio-input value="\int_0^1 x^2 \, dx" readonly />
      </section>
    </div>
  </ClientOnly>
</template>

<style scoped>
.elements-demo section {
  margin: 1.25rem 0;
}
.elements-demo h4 {
  margin: 0 0 0.4rem;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--vp-c-text-2);
}
</style>
