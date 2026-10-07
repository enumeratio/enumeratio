<script setup lang="ts">
// A carrier's statistics and maps, as rows that link to their own pages: the page lists what
// each is, and the per-carrier page holds the detail.
import type { CarrierFields, Field } from "../../data/carrier-fields.ts";
import { renderInline } from "../../prose.ts";

defineProps<{ fields: CarrierFields }>();

const inline = (text?: string): string => renderInline(text ?? "");
const ids = (field: Field): string[] => field.findstat.map((f) => f.id);
const properties = (field: Field): string[] => [
  ...new Set([...field.laws, ...field.findstat.flatMap((f) => f.properties ?? [])]),
];
</script>

<template>
  <section v-if="fields.statistics.length" id="statistics" class="carrier-fields">
    <h2>Statistics</h2>
    <p class="cf-note">On {{ fields.carrier }}, called as <code>CombinatorialStat(x, "Name")</code>.</p>
    <ul>
      <li v-for="s in fields.statistics" :key="s.name">
        <a :href="s.href">{{ s.name }}</a>
        <a v-for="f in s.findstat" :key="f.id" :href="f.url" class="cf-chip">{{ f.id }}</a>
        <span v-if="s.summary" class="cf-summary" v-html="inline(s.summary)"></span>
      </li>
    </ul>
  </section>

  <section
    v-if="fields.mapsFrom.length || fields.mapsTo.length || fields.otherMaps.length"
    id="maps"
    class="carrier-fields"
  >
    <h2>Maps</h2>
    <p class="cf-note">
      Into and out of {{ fields.carrier }}, called as <code>CombinatorialMap(x, "Name")</code>. Properties are the laws
      we state and what FindStat records.
    </p>
    <template
      v-for="group in [
        { title: 'From', rows: fields.mapsFrom },
        { title: 'To', rows: fields.mapsTo },
      ]"
      :key="group.title"
    >
      <template v-if="group.rows.length">
        <h3>{{ group.title }} {{ fields.carrier }}</h3>
        <ul>
          <li v-for="m in group.rows" :key="`${m.carrier}:${m.name}`" :class="{ 'cf-frontier': m.frontier }">
            <a :href="m.href">{{ m.name }}</a>
            <span class="cf-arrow">{{ m.carrier }} → {{ m.to }}</span>
            <span v-for="p in properties(m)" :key="p" class="cf-chip">{{ p }}</span>
            <a v-for="id in ids(m)" :key="id" :href="`https://www.findstat.org/${id}`" class="cf-chip">{{ id }}</a>
            <span v-if="m.summary" class="cf-summary" v-html="inline(m.summary)"></span>
          </li>
        </ul>
      </template>
    </template>
    <details v-if="fields.otherMaps.length" class="cf-other">
      <summary>{{ fields.otherMaps.length }} more in FindStat, not implemented here</summary>
      <ul>
        <li v-for="m in fields.otherMaps" :key="m.id">
          <a :href="`https://www.findstat.org/${m.id}`">{{ m.id }}</a>
          <span class="cf-arrow">{{ m.from }} → {{ m.to }}</span>
          <span v-for="p in m.properties" :key="p" class="cf-chip">{{ p }}</span>
          <span class="cf-summary">{{ m.title }}</span>
        </li>
      </ul>
    </details>
  </section>
</template>

<style scoped>
.cf-note {
  color: var(--vp-c-text-3);
  font-size: 0.85rem;
}
.cf-chip {
  display: inline-block;
  margin: 0 0.3rem 0 0.4rem;
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  background: var(--vp-c-default-soft);
  color: var(--vp-c-text-2);
  font-family: var(--vp-font-family-mono);
  font-size: 0.72rem;
  text-decoration: none;
}
.cf-arrow {
  margin-left: 0.5rem;
  color: var(--vp-c-text-3);
  font-size: 0.8rem;
}
.cf-summary {
  margin-left: 0.5rem;
  color: var(--vp-c-text-2);
  font-size: 0.85rem;
}
.cf-frontier {
  opacity: 0.6;
}
.cf-other summary {
  cursor: pointer;
  color: var(--vp-c-text-2);
  font-size: 0.9rem;
}
</style>
