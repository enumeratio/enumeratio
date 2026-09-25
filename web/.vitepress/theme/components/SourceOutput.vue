<script setup lang="ts">
// A source-output (language) page body: a try-it notebook cell preconfigured to
// the language's form, then a set of expressions each shown as In (StandardForm)
// → Out (the language's source of the expression, via `box` so it's the
// expression, not the evaluated result), with notes and "differs from <system>"
// chips. All output is derived live.
import { sourceLanguages, sourceRows } from "../../data/source-outputs.ts";

const props = defineProps<{ language: string }>();
const meta = sourceLanguages.find((l) => l.id === props.language);
const rows = sourceRows[props.language] ?? [];
const toJson = (expr: unknown): string => JSON.stringify(expr);
</script>

<template>
  <ClientOnly>
    <div v-if="meta">
      <div class="so-try">
        <p class="so-try-label">Try it — edit the input, watch the {{ meta.title }} source:</p>
        <notatio-cell :value="meta.sample" :out-form="meta.form" box />
      </div>
      <div v-for="(row, i) in rows" :key="i" class="so-row" :class="{ 'is-divergent': row.divergence }">
        <p v-if="row.label" class="so-label">{{ row.label }}</p>
        <div class="so-io">
          <notatio-out label="In" :value="toJson(row.expr)" format="mathjson" />
          <span class="so-arrow">→</span>
          <notatio-out label="Out" :value="toJson(row.expr)" format="mathjson" :form="meta.form" box />
        </div>
        <p v-if="row.note" class="so-note">{{ row.note }}</p>
        <p v-if="row.divergence" class="so-div">
          <span class="so-chip">differs from {{ meta.system }}</span> {{ row.divergence }}
        </p>
      </div>
    </div>
    <p v-else>Unknown language: {{ language }}</p>
  </ClientOnly>
</template>

<style scoped>
.so-try {
  margin: 1rem 0 1.5rem;
  padding: 0.7rem 0.9rem;
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 8px;
  background: var(--vp-c-brand-soft, rgba(100, 108, 255, 0.06));
}
.so-try-label {
  margin: 0 0 0.5rem;
  font-size: 0.8rem;
  color: var(--vp-c-text-2);
}
.so-row {
  margin: 0.9rem 0;
  padding: 0.6rem 0.8rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
}
.so-row.is-divergent {
  border-left: 3px solid #d9931a;
}
.so-label {
  margin: 0 0 0.4rem;
  font-size: 0.85rem;
  color: var(--vp-c-text-2);
}
.so-io {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}
.so-arrow {
  color: var(--vp-c-text-3);
}
.so-note,
.so-div {
  margin: 0.4rem 0 0;
  font-size: 0.8rem;
  color: var(--vp-c-text-2);
}
.so-chip {
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  background: rgba(217, 147, 26, 0.14);
  color: #b7791f;
  font-size: 0.72rem;
  white-space: nowrap;
}
</style>
