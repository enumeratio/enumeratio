<script setup lang="ts">
// The full combinatorial-glyph vocabulary, one family per row -- a visual index
// of the `<notatio-figure>` representations. Each item is the element itself, so
// this doubles as an integration check of the glyph renderers in the browser.
const families: Array<{
  kind: string;
  title: string;
  items: Array<{ value: number[]; cap: string; n?: number }>;
}> = [
  {
    kind: "permutation",
    title: "permutation — S₃ (matrix glyph: dot per row at image[i])",
    items: [
      [1, 2, 3],
      [1, 3, 2],
      [2, 1, 3],
      [2, 3, 1],
      [3, 1, 2],
      [3, 2, 1],
    ].map((p) => ({ value: p, cap: p.join("") })),
  },
  {
    kind: "partition",
    title: "partition — p(5) (Ferrers / Young diagram)",
    items: [[5], [4, 1], [3, 2], [3, 1, 1], [2, 2, 1], [2, 1, 1, 1], [1, 1, 1, 1, 1]].map((p) => ({
      value: p,
      cap: p.join("+"),
    })),
  },
  {
    kind: "composition",
    title: "composition — of 4 (divided bar, width ∝ n)",
    items: [[4], [3, 1], [1, 3], [2, 2], [2, 1, 1], [1, 1, 1, 1]].map((c) => ({
      value: c,
      cap: c.join("+"),
    })),
  },
  {
    kind: "subset",
    title: "subset — of {1..4} (membership cells)",
    items: [[], [1], [2, 4], [1, 2, 3], [1, 2, 3, 4]].map((s) => ({
      value: s,
      cap: `{${s.join(",")}}`,
      n: 4,
    })),
  },
  {
    kind: "dyck",
    title: "Dyck path — semilength 3 (mountain range, Catalan 5)",
    items: [
      [1, 0, 1, 0, 1, 0],
      [1, 0, 1, 1, 0, 0],
      [1, 1, 0, 0, 1, 0],
      [1, 1, 0, 1, 0, 0],
      [1, 1, 1, 0, 0, 0],
    ].map((d) => ({ value: d, cap: d.join("") })),
  },
];
</script>

<template>
  <ClientOnly>
    <div class="gallery">
      <section v-for="fam in families" :key="fam.kind">
        <h4>{{ fam.title }}</h4>
        <div class="strip">
          <figure v-for="(it, i) in fam.items" :key="i">
            <notatio-figure :kind="fam.kind" :value="JSON.stringify(it.value)" :n="it.n" />
            <figcaption>{{ it.cap }}</figcaption>
          </figure>
        </div>
      </section>
    </div>
  </ClientOnly>
</template>

<style scoped>
.gallery section {
  margin: 1.4rem 0;
}
.gallery h4 {
  margin: 0 0 0.5rem;
  font-size: 0.8rem;
  color: var(--vp-c-text-2);
}
.strip {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-end;
}
figure {
  margin: 0;
  text-align: center;
}
figcaption {
  margin-top: 0.35rem;
  font-family: var(--vp-font-family-mono);
  font-size: 0.7rem;
  color: var(--vp-c-text-3);
}
</style>
