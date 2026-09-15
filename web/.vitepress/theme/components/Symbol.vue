<script setup lang="ts">
// One control for every cross reference on the site. `<Symbol>Inversions</Symbol>` links a
// head to its own reference page and hovers its signature and summary; `type` retargets the
// same wrapper at an outside source -- `<Symbol type="sage">SetComposition</Symbol>` is
// still OUR name, and the link is whatever the crosswalk records for it in Sage
// (`OrderedSetPartitions`), so prose never has to know the other system's spelling.
//
// `to` overrides that when the text is not a head at all, or the target is a page the
// crosswalk does not carry (`<Symbol type="wikipedia" to="Dyck_path">Dyck paths</Symbol>`);
// for a system with a URL scheme the bare text is the slug of last resort.
import { crosswalkFor } from "@enumeratio/reference";
import { computed, useSlots } from "vue";
import { getEntry } from "../../data/reference.ts";
import { type SymbolKind, SYMBOL_SOURCES } from "../../data/symbol-links.ts";

const props = withDefaults(
  defineProps<{ name?: string; type?: SymbolKind; to?: string; plain?: boolean }>(),
  { type: "notatio" },
);
const slots = useSlots();

/** The link text: the `name` prop, or the default slot rendered to text. */
const text = computed(() => {
  if (props.name) return props.name;
  const nodes = slots.default?.() ?? [];
  return nodes
    .map((node) => (typeof node.children === "string" ? node.children : ""))
    .join("")
    .trim();
});

const slug = computed(() => props.to ?? text.value);
const source = computed(() => SYMBOL_SOURCES[props.type] ?? SYMBOL_SOURCES.notatio);

// What the crosswalk knows about this head in the named system, when nothing overrides it.
const crossed = computed(() =>
  props.type === "notatio" || props.to
    ? undefined
    : crosswalkFor(text.value, getEntry(text.value)).find(
        (reference) => reference.system === props.type && reference.href,
      ),
);
const href = computed(() => crossed.value?.href ?? source.value.href?.(slug.value));

// Only our own entries can describe themselves; an outside link says where it goes instead.
const entry = computed(() => (props.type === "notatio" ? getEntry(slug.value) : undefined));
const tip = computed(() => {
  if (props.type !== "notatio") {
    return `${crossed.value?.identity ?? slug.value} on ${source.value.label}`;
  }
  const found = entry.value;
  if (!found) return undefined;
  // The summary carries `$…$` LaTeX; a title attribute is plain text, so show it as written.
  return `${found.signature} — ${found.summary}`;
});

// An unknown head is not a link. Silently rendering a dead one is worse than plain code:
// the reference is generated, so a name that resolves to nothing is a typo or a rename --
// and an outside system with no scheme and no crosswalk row has nowhere to send anyone.
const known = computed(() =>
  props.type === "notatio" ? entry.value !== undefined : href.value !== undefined,
);
</script>

<template>
  <a
    v-if="known && !plain"
    class="symbol-ref"
    :class="{ 'is-external': source.external }"
    :href="href"
    :title="tip"
    :target="source.external ? '_blank' : undefined"
    :rel="source.external ? 'noopener noreferrer' : undefined"
    :aria-label="source.external ? `${text} on ${source.label}` : undefined"
    ><code>{{ text }}</code
    ><span v-if="source.external" class="symbol-out" aria-hidden="true">↗</span></a
  >
  <code v-else class="symbol-ref is-plain">{{ text }}</code>
</template>

<style scoped>
.symbol-ref {
  text-decoration: none;
  white-space: nowrap;
}
.symbol-ref code {
  /* Read as code first and a link second: the underline only shows on hover. */
  color: var(--vp-c-text-1);
  border-bottom: 1px solid transparent;
  transition:
    color 0.2s,
    border-color 0.2s;
}
.symbol-ref:hover code {
  color: var(--vp-c-brand-1);
  border-bottom-color: var(--vp-c-brand-1);
}
.symbol-ref.is-plain code {
  color: var(--vp-c-text-1);
}
.symbol-out {
  margin-left: 0.12em;
  font-size: 0.78em;
  vertical-align: 0.15em;
  color: var(--vp-c-text-3);
}
.symbol-ref:hover .symbol-out {
  color: var(--vp-c-brand-1);
}
</style>
