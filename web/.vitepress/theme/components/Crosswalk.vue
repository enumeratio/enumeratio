<script setup lang="ts">
// The crosswalk strip: where a head lives elsewhere, one chip per pointer, grouped by
// system in the crosswalk's display order. Inline (under a signature, in a table cell) the
// arity marker is dropped -- the signature already says it. A chip is a link when the system has a page for
// it and plain text when only the name is known (a SymPy function with no stable URL).
// Hovering says where the pointer came from -- the engine, Fungrim, the catalog, a hand.
//
// Fungrim ENTRIES are the one system that runs long (a head like `Exp` is in a hundred
// identities), so they collapse behind a count.
import { groupBySystem, type ResolvedReference } from "@enumeratio/reference";
import { computed, ref } from "vue";

const props = defineProps<{
  references: readonly ResolvedReference[];
  /** Render as a single inline run (for a signature or a table cell) rather than a block. */
  inline?: boolean;
}>();

const groups = computed(() => groupBySystem(props.references));
const FOLD_ABOVE = 6;
const unfolded = ref<Set<string>>(new Set());
const toggle = (system: string): void => {
  const next = new Set(unfolded.value);
  if (next.has(system)) next.delete(system);
  else next.add(system);
  unfolded.value = next;
};
const shown = (group: { system: string; references: ResolvedReference[] }): ResolvedReference[] =>
  group.references.length > FOLD_ABOVE && !unfolded.value.has(group.system) ? [] : group.references;

const ORIGIN_TITLE: Record<string, string> = {
  entry: "written on the entry",
  findstat: "found by FindStat's finder, by value",
  oeis: "found in the OEIS, by the family's counts",
  dlmf: "found in the DLMF's index of notations, by name",
  wikidata: "from the Wikidata item's own identifiers",
  curated: "from the hand-kept crosswalk table",
  catalog: "from the enumeratio catalog's own crosswalk",
  engine: "from compute-engine's definition of the symbol",
  fungrim: "from the Fungrim identities compute-engine ships",
  wolfram: "vouched for by the Wolfram transpiler",
  oracle: "the oracle's equivalent call in that kernel",
};
const RELATION_TITLE: Record<string, string> = {
  partial: "a filter on a larger class over there",
  aggregate: "the count agrees; the object is not the same",
  conceptual: "a grounding page, not the same object",
};
// A chip shows the page, not the section: `Permutation#Ascents, descents…` is a long way
// to say Permutation, and the anchor is still in the link and the tooltip.
const shortName = (reference: ResolvedReference): string => {
  if (reference.system === "wikipedia") return reference.identity.replace(/#.*$/, "");
  // The DLMF addresses an equation as `5.2#E1` and cites it as 5.2.E1.
  if (reference.system === "dlmf") return reference.identity.replace("#", ".");
  return reference.identity;
};

const VERIFIED_TITLE: Record<string, (n: number) => string> = {
  values: (n) => `checked: our definition agrees with theirs on ${n} values`,
  terms: (n) => `checked: our count agrees with their sequence on ${n} terms`,
  examples: (n) => `checked: ${n} of this head's examples were run in that kernel and agreed`,
  identities: (n) => `checked: ${n} identities agreed when evaluated`,
};
const verifiedTip = (reference: ResolvedReference): string | undefined => {
  const v = reference.verified;
  if (!v) return undefined;
  const agreed = VERIFIED_TITLE[v.by]?.(v.count) ?? `checked on ${v.count}`;
  const parts = [v.count ? agreed : undefined, v.disagree ? `${v.disagree} DISAGREED` : undefined];
  return [parts.filter(Boolean).join("; "), v.note].filter(Boolean).join(" · ");
};
const tip = (reference: ResolvedReference): string =>
  [
    `${reference.identity} on ${reference.label}`,
    ORIGIN_TITLE[reference.origin],
    reference.verified
      ? VERIFIED_TITLE[reference.verified.by]?.(reference.verified.count)
      : undefined,
    reference.via ? `recorded against ${reference.via}` : undefined,
    reference.relation ? RELATION_TITLE[reference.relation] : undefined,
    reference.arity !== undefined ? `for the ${reference.arity}-argument form` : undefined,
    reference.note,
  ]
    .filter(Boolean)
    .join(" · ");
</script>

<template>
  <div v-if="groups.length" class="crosswalk" :class="{ 'is-inline': inline }">
    <span v-for="group in groups" :key="group.system" class="xw-group">
      <span class="xw-system">{{ group.label }}</span>
      <template v-for="(reference, i) in shown(group)" :key="i">
        <a
          v-if="reference.href"
          class="xw-chip"
          :class="[
            `is-${reference.origin}`,
            reference.relation ? `is-${reference.relation}` : '',
            { 'is-arity': reference.arity !== undefined },
          ]"
          :href="reference.href"
          :title="tip(reference)"
          target="_blank"
          rel="noopener noreferrer"
          ><code>{{ shortName(reference) }}</code
          ><sup v-if="reference.arity !== undefined && !inline" class="xw-arity"
            >/{{ reference.arity }}</sup
          ><span v-if="reference.via" class="xw-via">via {{ reference.via }}</span
          ><span
            v-if="reference.verified"
            class="xw-verified"
            :class="{ 'is-broken': reference.verified.disagree }"
            :aria-label="reference.verified.disagree ? 'checked, with disagreements' : 'checked'"
            >{{ reference.verified.disagree ? "!" : "✓" }}</span
          ><span class="xw-out" aria-hidden="true">↗</span></a
        >
        <span
          v-else
          class="xw-chip is-plain"
          :class="`is-${reference.origin}`"
          :title="tip(reference)"
          ><code>{{ shortName(reference) }}</code
          ><sup v-if="reference.arity !== undefined && !inline" class="xw-arity"
            >/{{ reference.arity }}</sup
          ><span v-if="reference.via" class="xw-via">via {{ reference.via }}</span></span
        >
      </template>
      <button
        v-if="group.references.length > FOLD_ABOVE"
        class="xw-fold"
        type="button"
        @click="toggle(group.system)"
      >
        {{ unfolded.has(group.system) ? "fold" : `${group.references.length} entries` }}
      </button>
    </span>
  </div>
</template>

<style scoped>
.crosswalk {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.9rem;
  margin: 0.6rem 0 1rem;
  font-size: 0.82rem;
  line-height: 1.7;
}
.crosswalk.is-inline {
  display: inline-flex;
  margin: 0 0 0 0.6rem;
  gap: 0.2rem 0.6rem;
  font-size: 0.76rem;
}
.xw-group {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.25rem;
}
.xw-system {
  color: var(--vp-c-text-3);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-right: 0.15rem;
}
.xw-chip {
  display: inline-flex;
  align-items: baseline;
  gap: 0.15rem;
  padding: 0 0.45rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  text-decoration: none;
  white-space: nowrap;
  transition:
    border-color 0.2s,
    color 0.2s;
}
.xw-chip code {
  background: none;
  padding: 0;
  font-size: 0.95em;
  color: inherit;
  max-width: 18rem;
  overflow: hidden;
  text-overflow: ellipsis;
}
a.xw-chip:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.xw-chip.is-plain {
  color: var(--vp-c-text-2);
  border-style: dashed;
}
.xw-chip.is-engine,
.xw-chip.is-wolfram {
  border-color: var(--vp-c-brand-soft);
}
.xw-chip.is-catalog {
  border-color: var(--vp-c-green-soft, var(--vp-c-divider));
}
.xw-arity,
.xw-via {
  color: var(--vp-c-text-3);
  font-size: 0.72em;
}
.xw-via {
  margin-left: 0.2rem;
  font-style: italic;
}
.xw-verified {
  color: var(--vp-c-green-1, #3a9c5a);
  font-size: 0.8em;
  margin-left: 0.1rem;
}
.xw-verified.is-broken {
  color: var(--vp-c-warning-1, #d9931a);
  font-weight: 700;
}
.xw-chip.is-aggregate,
.xw-chip.is-partial,
.xw-chip.is-conceptual {
  border-style: dotted;
}
.xw-out {
  font-size: 0.75em;
  color: var(--vp-c-text-3);
  vertical-align: 0.15em;
}
.xw-fold {
  border: 0;
  background: none;
  color: var(--vp-c-brand-1);
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
  padding: 0 0.2rem;
}
</style>
