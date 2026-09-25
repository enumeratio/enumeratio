<script setup lang="ts">
import type { ResolvedReference } from "@enumeratio/reference";
import { computed, ref } from "vue";
import Crosswalk from "./Crosswalk.vue";

// A generic reference *catalogue* — the flat, scannable list a class of things wants
// (all statistics, all maps, all collections, all domains), distinct from the per-symbol
// page. Each row is a name, some badges (carrier, from→to, shape, …), and a one-liner.
interface Row {
  readonly name: string;
  readonly href?: string;
  readonly badges?: readonly string[];
  readonly summary?: string;
  readonly note?: string;
  readonly frontier?: boolean;
  readonly references?: readonly ResolvedReference[];
}

const props = defineProps<{
  rows: readonly Row[];
  /** Column header over the badges, e.g. "carrier" or "from → to". */
  badgeLabel?: string;
}>();

const q = ref("");
const shown = computed(() => {
  const s = q.value.trim().toLowerCase();
  if (!s) return props.rows;
  return props.rows.filter(
    (r) =>
      r.name.toLowerCase().includes(s) ||
      (r.summary ?? "").toLowerCase().includes(s) ||
      (r.badges ?? []).some((b) => b.toLowerCase().includes(s)) ||
      (r.references ?? []).some((x) => x.identity.toLowerCase().includes(s)),
  );
});
const anyReferences = computed(() => props.rows.some((r) => r.references?.length));
const linked = computed(() => shown.value.filter((r) => r.references?.length).length);
</script>

<template>
  <div class="ref-catalog">
    <div class="ref-cat-bar">
      <input class="ref-cat-search" v-model="q" placeholder="filter by name, badge or summary…" />
      <span class="ref-cat-count"
        >{{ shown.length }} of {{ rows.length
        }}<template v-if="anyReferences"> · {{ linked }} linked elsewhere</template></span
      >
    </div>
    <table class="ref-cat-table">
      <thead>
        <tr>
          <th>name</th>
          <th>{{ badgeLabel ?? "" }}</th>
          <th>summary</th>
          <th v-if="anyReferences">elsewhere</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in shown" :key="r.name + (r.badges?.join(',') ?? '')" :class="{ 'is-frontier': r.frontier }">
          <td class="ref-cat-name">
            <a v-if="r.href" :href="r.href"
              ><code>{{ r.name }}</code></a
            >
            <code v-else>{{ r.name }}</code>
          </td>
          <td class="ref-cat-badges">
            <span v-for="b in r.badges" :key="b" class="ref-cat-badge">{{ b }}</span>
          </td>
          <td class="ref-cat-summary">
            {{ r.summary }}<span v-if="r.note" class="ref-cat-note"> — {{ r.note }}</span>
          </td>
          <td v-if="anyReferences" class="ref-cat-refs">
            <Crosswalk v-if="r.references?.length" :references="r.references" inline />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.ref-catalog {
  margin: 1rem 0;
  overflow-x: auto;
}
.ref-cat-bar {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  margin-bottom: 0.6rem;
}
.ref-cat-search {
  flex: 1 1 auto;
  padding: 0.35rem 0.6rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 0.85rem;
}
.ref-cat-search:focus {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: -1px;
}
.ref-cat-count {
  color: var(--vp-c-text-3);
  font-variant-numeric: tabular-nums;
  font-size: 0.8rem;
  white-space: nowrap;
}
.ref-cat-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}
.ref-cat-table th {
  text-align: left;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--vp-c-text-3);
  border-bottom: 1px solid var(--vp-c-divider);
  padding: 0.3rem 0.6rem;
}
.ref-cat-table td {
  border-bottom: 1px solid var(--vp-c-divider);
  padding: 0.3rem 0.6rem;
  vertical-align: baseline;
}
.ref-cat-table tbody tr:hover {
  background: var(--vp-c-bg-soft);
}
.ref-cat-name {
  white-space: nowrap;
}
.ref-cat-name code {
  background: none;
  padding: 0;
  color: var(--vp-c-text-1);
  font-weight: 600;
}
.ref-cat-name a code {
  color: var(--vp-c-brand-1);
}
.ref-cat-badges {
  white-space: nowrap;
}
.ref-cat-badge {
  display: inline-block;
  margin-right: 0.3rem;
  padding: 0.05rem 0.4rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  font-family: var(--vp-font-family-mono, ui-monospace, monospace);
  font-size: 0.72rem;
}
.ref-cat-summary {
  color: var(--vp-c-text-2);
  min-width: 14rem;
}
.ref-cat-note {
  color: var(--vp-c-text-3);
}
.ref-cat-refs {
  min-width: 11rem;
}
.ref-cat-refs :deep(.crosswalk.is-inline) {
  margin: 0;
}
.is-frontier .ref-cat-name code {
  color: var(--vp-c-text-3);
  font-weight: 400;
}
</style>
