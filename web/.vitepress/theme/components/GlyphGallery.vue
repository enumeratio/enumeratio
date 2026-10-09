<script setup lang="ts">
// The full combinatorial-glyph vocabulary, one family per row -- a visual index of the
// pictures each kind lowers to. Each item is the `<graphics-box>` it stands for, so this
// doubles as an integration check of the frames in the browser.
import { lowerFigure } from "@enumeratio/frontend/core";

const families: Array<{
  kind: string;
  title: string;
  items: Array<{ value: number[]; cap: string; n?: number }>;
}> = [
  {
    kind: "permutation",
    title: "permutation — S₃ (strand diagram: i on the in row joined to image(i) on the out row)",
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
    title: "partition — p(5) (CellDiagram: a cell at each (row, column), rows as long as the parts)",
    items: [[5], [4, 1], [3, 2], [3, 1, 1], [2, 2, 1], [2, 1, 1, 1], [1, 1, 1, 1, 1]].map((p) => ({
      value: p,
      cap: p.join("+"),
    })),
  },
  {
    kind: "composition",
    title: "composition — of 4 (CellDiagram: one cell per part, width ∝ its value)",
    items: [[4], [3, 1], [1, 3], [2, 2], [2, 1, 1], [1, 1, 1, 1]].map((c) => ({
      value: c,
      cap: c.join("+"),
    })),
  },
  {
    kind: "subset",
    title: "subset — of {1..4} (CellDiagram: a cell per element, members Filled)",
    items: [[], [1], [2, 4], [1, 2, 3], [1, 2, 3, 4]].map((s) => ({
      value: s,
      cap: `{${s.join(",")}}`,
      n: 4,
    })),
  },
  {
    kind: "dyck",
    title: "Dyck path — semilength 3 (PathDiagram: points at (step, height), steps as links; Catalan 5)",
    items: [
      [1, 0, 1, 0, 1, 0],
      [1, 0, 1, 1, 0, 0],
      [1, 1, 0, 0, 1, 0],
      [1, 1, 0, 1, 0, 0],
      [1, 1, 1, 0, 0, 0],
    ].map((d) => ({ value: d, cap: d.join("") })),
  },
  {
    kind: "tableau",
    title: "tableau — shapes of 4 (CellDiagram: superstandard filling, an Entry per cell)",
    items: [[4], [3, 1], [2, 2], [2, 1, 1], [1, 1, 1, 1]].map((p) => ({ value: p, cap: p.join("+") })),
  },
  {
    kind: "lattice",
    title: "lattice path — 2 east, 2 north (PathDiagram: points at (x, y) on the grid)",
    items: [
      [0, 0, 1, 1],
      [0, 1, 0, 1],
      [0, 1, 1, 0],
      [1, 0, 0, 1],
      [1, 0, 1, 0],
      [1, 1, 0, 0],
    ].map((p) => ({ value: p, cap: p.join("") })),
  },
  {
    kind: "binary-tree",
    title: "binary tree — 2 internal nodes (TreeDiagram: nodes at (depth, order), parent edges as links)",
    items: [
      [1, 1, 0, 0, 0],
      [1, 0, 1, 0, 0],
    ].map((t) => ({ value: t, cap: t.join("") })),
  },
  {
    kind: "tree",
    title: "plane tree — preorder child counts (TreeDiagram)",
    items: [
      [2, 0, 1, 0],
      [3, 0, 2, 0, 0, 1, 0],
      [1, 1, 1, 0],
    ].map((t) => ({ value: t, cap: t.join("") })),
  },
];

const pictured = families.map((fam) => ({
  ...fam,
  items: fam.items.map((it) => ({ ...it, picture: lowerFigure(fam.kind, it.value, { n: it.n }) })),
}));
</script>

<template>
  <ClientOnly>
    <div class="gallery">
      <section v-for="fam in pictured" :key="fam.kind">
        <h4>{{ fam.title }}</h4>
        <div class="strip">
          <figure v-for="(it, i) in fam.items" :key="i">
            <graphics-box
              v-if="it.picture"
              class="inline-figure"
              :value="it.picture.show"
              legend-at="none"
              caption-at="none"
              :style="{ width: `${it.picture.width}px` }"
            />
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
