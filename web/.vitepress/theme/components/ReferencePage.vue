<script setup lang="ts">
import { crosswalkFor, type ResolvedReference } from "@enumeratio/reference";
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { getEntry, resolveHead } from "../../data/reference.ts";
import Crosswalk from "./Crosswalk.vue";
import ExampleAlternatives, { type Alternative } from "./ExampleAlternatives.vue";

const props = defineProps<{ name: string }>();
const entry = computed(() => getEntry(props.name));

// Where this head lives elsewhere. Rows about one call form (Zeta at two arguments is
// Hurwitz's) sit with that signature; everything else heads the page.
const references = computed(() => crosswalkFor(props.name, entry.value));
const headwide = computed(() => references.value.filter((r) => r.arity === undefined));
const forSignature = (signature: { arity?: number; call: string }): ResolvedReference[] => {
  const params = (signature.call.match(/\(([^()]*)\)/)?.[1] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const arity = signature.arity ?? params.length;
  // An oracle row is a call template over `$1`, `$2`…; on a signature the operands have
  // names, so `hurwitz_zeta($1, $2)` reads as `hurwitz_zeta(s, a)`.
  return references.value
    .filter((r) => r.arity === arity)
    .map((r) => ({
      ...r,
      identity: r.identity.replace(/\$(\d+)/g, (_m, k: string) => params[Number(k) - 1] ?? "_"),
    }));
};

// notatio-out takes the MathJSON expression as a JSON string.
const toJson = (expr: unknown): string => JSON.stringify(expr);

const escapeAttr = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Render prose: $latex$ becomes inline typeset math; [[Symbol]] becomes a link.
const linkify = (text?: string): string =>
  (text ?? "")
    .replace(
      /\$([^$]+)\$/g,
      (_match, tex: string) =>
        `<notatio-out inline format="latex" value="${escapeAttr(tex)}"></notatio-out>`,
    )
    .replace(/\[\[([A-Za-z0-9]+)\]\]/g, (_match, name: string) =>
      getEntry(name) ? `<a class="ref-link" href="/reference/symbol/${name}">${name}</a>` : name,
    );

// What each implementation row is, for the badge tooltip and the pointer it shows.
const ORIGIN_TITLE: Record<string, string> = {
  reference:
    "the defining expression, in notatio — the specification the others are checked against",
  native: "the TypeScript that actually runs",
  compiled: "produced by a compute-engine compile target",
  component: "bottoms out in a web component — the rendered element is the value",
  mapped: "the equivalent call in an external system",
};
const ENVIRONMENT_TITLE: Record<string, string> = {
  engine: "plain compute-engine evaluation; works anywhere the engine does",
  browser: "needs the DOM, and usually a custom element",
  gpu: "compiled to a shader and evaluated on the GPU",
  node: "server-side only",
  external: "another system's kernel entirely",
};
const MAPPINGS_SOURCE = "packages/oracle/src/mappings.ts";
const sourceOf = (impl: { origin: string; source?: string }): string | undefined =>
  impl.source ?? (impl.origin === "mapped" ? MAPPINGS_SOURCE : undefined);

// Why a head sits on the primitive frontier rather than reducing further.
const PRIMITIVE_REASON: Record<string, string> = {
  kernel: "a kernel — an algorithm over mutable state that would not be readable as a tree",
  numeric: "irreducibly numeric — it evaluates rather than rewrites",
  foreign: "hands off to something outside the engine entirely",
  axiom: "definitional — what other things are defined in terms of",
};

// Assertion outcome per example, reported by the cell's Out via notatio-assert
// (bubbles straight through -- the cell doesn't need to relay it).
const status = reactive<Record<number, string>>({});
const onAssert = (i: number, event: Event): void => {
  status[i] = (event as CustomEvent<{ status: string }>).detail.status;
};

// Known-divergence chips, one per system the example diverges from.
const SYSTEM_LABEL: Record<string, string> = { wolfram: "Wolfram", numpy: "NumPy", sympy: "SymPy" };
const divergences = (ex: {
  divergence?: Record<string, string>;
}): { system: string; label: string; note: string }[] =>
  Object.entries(ex.divergence ?? {}).map(([system, note]) => ({
    system,
    label: SYSTEM_LABEL[system] ?? system,
    note,
  }));

// An example is a live notatio-cell; the cell owns editing, conversion and reset. We
// just track which examples are dirty (edited), for the card's classes and to hide
// what described the original value.
const dirty = reactive<Record<number, boolean>>({});
const onDirty = (i: number, event: Event): void => {
  dirty[i] = (event as CustomEvent<{ dirty: boolean }>).detail.dirty;
  if (dirty[i]) delete status[i];
};

// Other systems' runs of each example, attached by entries.ts from the entry's
// `<stem>.oracle.json` sidecar (see `@enumeratio/oracle`).
const alternativesOf = (ex: {
  others?: Record<string, Alternative>;
}): Record<string, Alternative> | undefined =>
  ex.others && Object.keys(ex.others).length > 0 ? ex.others : undefined;
// A row's own note, preferring the entry's authored `divergence` prose over the scan's.
const notesOf = (ex: {
  others?: Record<string, { note?: string }>;
  divergence?: Record<string, string>;
}): Record<string, string> => {
  const notes: Record<string, string> = { ...ex.divergence };
  for (const [system, run] of Object.entries(ex.others ?? {})) {
    if (notes[system] === undefined && run.note) notes[system] = run.note;
  }
  return notes;
};
const sectionsOpen = ref(true);

/** A section's anchor: `Possible issues` → `#possible-issues`. */
const sectionId = (category: string): string => category.toLowerCase().replace(/[^a-z0-9]+/g, "-");
// A linked section opens even under "close all", and is scrolled to once the client-only
// sections exist (the browser's own hash scroll runs before they render).
const targeted = ref("");
const followHash = async (): Promise<void> => {
  targeted.value = decodeURIComponent(location.hash.slice(1));
  if (targeted.value === "") return;
  await nextTick();
  document.getElementById(targeted.value)?.scrollIntoView();
};
onMounted(() => {
  void followHash();
  window.addEventListener("hashchange", followHash);
});
onBeforeUnmount(() => window.removeEventListener("hashchange", followHash));

// Examples grouped into categories, keeping each example's original index so
// assertion status stays addressable.
const CATEGORY_ORDER = [
  "Basic",
  "Scope",
  "Applications",
  "Properties",
  "Possible issues",
  "Neat examples",
];
const grouped = computed(() => {
  const list = entry.value?.examples ?? [];
  const byCategory = new Map<string, { ex: (typeof list)[number]; i: number }[]>();
  list.forEach((ex, i) => {
    const category = ex.category ?? "Basic";
    const group = byCategory.get(category) ?? [];
    group.push({ ex, i });
    byCategory.set(category, group);
  });
  const rank = (c: string): number => {
    const i = CATEGORY_ORDER.indexOf(c);
    return i === -1 ? CATEGORY_ORDER.length : i;
  };
  return [...byCategory.entries()]
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([category, items]) => ({ category, items }));
});
</script>

<template>
  <div v-if="entry" class="reference-entry">
    <p v-if="entry.stub === 'engine'" class="ref-stub">
      Generated from the engine's own definition: compute-engine's symbol, which we neither extend
      nor document by hand. No examples yet — the crosswalk is the reason it has a page.
    </p>
    <p v-else-if="entry.stub === 'carrier'" class="ref-stub">
      A carrier domain from <a href="/reference/domains/">the domains catalogue</a>; the signature
      is its storage shape. What is known about it elsewhere is mostly recorded against the
      collections that enumerate it, and says so.
    </p>
    <!-- eslint-disable-next-line vue/no-v-html -- prose is trusted local data -->
    <p v-html="linkify(entry.summary)"></p>

    <Crosswalk :references="headwide" />

    <div v-if="entry.signatures?.length" class="ref-signatures">
      <div v-for="(sig, i) in entry.signatures" :key="i" class="ref-signature">
        <code>{{ sig.call }}</code>
        <!-- eslint-disable-next-line vue/no-v-html -- prose is trusted local data -->
        <span class="ref-sig-desc" v-html="linkify(sig.description)"></span>
        <Crosswalk v-if="forSignature(sig).length" :references="forSignature(sig)" inline />
      </div>
    </div>
    <p v-else class="ref-sig">
      <code>{{ entry.signature }}</code>
    </p>

    <p class="ref-meta">
      <span>Domain: {{ entry.domain }}</span>
    </p>

    <details v-if="entry.details?.length" class="ref-details" open>
      <summary>Details</summary>
      <ul>
        <!-- eslint-disable-next-line vue/no-v-html -- prose is trusted local data -->
        <li v-for="(d, i) in entry.details" :key="i" v-html="linkify(d)"></li>
      </ul>
    </details>

    <template v-if="entry.enumerate">
      <h2>Enumeration</h2>
      <ClientOnly>
        <notatio-collection-table
          :expr="entry.enumerate.expr"
          :columns="entry.enumerate.columns"
          :glyph="entry.enumerate.glyph"
          :page-size="entry.enumerate.pageSize ?? 10"
        ></notatio-collection-table>
      </ClientOnly>
    </template>

    <div v-if="grouped.length" class="ref-examples-head">
      <h2>Examples</h2>
      <span class="ref-view">
        <button v-if="grouped.length > 1" @click="sectionsOpen = !sectionsOpen">
          {{ sectionsOpen ? "close all" : "open all" }}
        </button>
      </span>
    </div>
    <ClientOnly>
      <details
        v-for="group in grouped"
        :key="group.category"
        class="ref-section"
        :class="{ 'is-bare': grouped.length <= 1 }"
        :id="sectionId(group.category)"
        :open="sectionsOpen || sectionId(group.category) === targeted"
      >
        <summary class="ref-category">
          {{ group.category }}
          <a
            class="ref-anchor"
            :href="`#${sectionId(group.category)}`"
            :aria-label="`Link to ${group.category}`"
            >#</a
          >
        </summary>
        <div
          v-for="{ ex, i } in group.items"
          :key="i"
          class="ref-example"
          :class="{
            'is-mismatch': status[i] === 'mismatch' && !ex.aspirational && !dirty[i],
            'is-diagnostic': status[i] === 'error' && !ex.aspirational,
            'is-planned': ex.aspirational,
            'is-divergent': divergences(ex).length > 0 && !dirty[i],
            'is-edited': dirty[i],
          }"
        >
          <!-- eslint-disable-next-line vue/no-v-html -- prose is trusted local data -->
          <p v-if="ex.caption" class="ref-caption" v-html="linkify(ex.caption)"></p>
          <notatio-cell
            format="mathjson"
            :value="toJson(ex.expr)"
            :out-form="entry.outForm ?? 'standard'"
            :evaluate.prop="entry.outEvaluate !== false"
            :expect="entry.outEvaluate === false || ex.volatile ? '' : toJson(ex.expected)"
            :planned.prop="entry.outEvaluate !== false && !!ex.aspirational"
            :resolveHead.prop="resolveHead"
            @notatio-dirty="onDirty(i, $event)"
            @notatio-assert="onAssert(i, $event)"
          >
            <span v-if="ex.aspirational" slot="aside" class="ref-planned-badge"
              >not yet implemented</span
            >
            <ExampleAlternatives
              v-else-if="alternativesOf(ex)"
              slot="aside"
              :alternatives="alternativesOf(ex)!"
              :notes="notesOf(ex)"
            />
            <span
              v-for="d in divergences(ex)"
              v-else
              :key="d.system"
              slot="aside"
              class="ref-divergent-badge"
            >
              differs from {{ d.label }}
            </span>
          </notatio-cell>
          <template v-if="!dirty[i] && !alternativesOf(ex)">
            <template v-for="d in divergences(ex)" :key="d.system">
              <!-- eslint-disable-next-line vue/no-v-html -- prose is trusted local data -->
              <p class="ref-divergence-note" v-html="linkify(d.note)"></p>
            </template>
          </template>
        </div>
      </details>
    </ClientOnly>

    <template v-if="entry.primitive || entry.implementations?.length">
      <h2>Implementation</h2>
      <p v-if="entry.primitive" class="ref-primitive">
        <span class="ref-badge is-primitive">primitive · {{ entry.primitive }}</span>
        <span class="ref-primitive-reason">{{ PRIMITIVE_REASON[entry.primitive] }}</span>
      </p>
      <div
        v-for="(impl, i) in entry.implementations ?? []"
        :key="i"
        class="ref-impl"
        :data-origin="impl.origin"
      >
        <div class="ref-impl-head">
          <span class="ref-badge ref-origin" :title="ORIGIN_TITLE[impl.origin]">
            {{ impl.origin }}
          </span>
          <span
            v-if="impl.environment"
            class="ref-badge ref-env"
            :title="ENVIRONMENT_TITLE[impl.environment]"
          >
            {{ impl.environment }}
          </span>
          <code class="ref-impl-form">{{ impl.form }}</code>
          <code v-if="sourceOf(impl)" class="ref-impl-source">{{ sourceOf(impl) }}</code>
        </div>
        <ClientOnly>
          <notatio-out
            v-if="impl.expr !== undefined"
            label="Def"
            :value="toJson(impl.expr)"
            format="mathjson"
            form="tree"
            raw
            :resolveHead.prop="resolveHead"
          />
        </ClientOnly>
        <notatio-code v-if="impl.code" :language="impl.form" :value="impl.code" />
        <!-- eslint-disable-next-line vue/no-v-html -- prose is trusted local data -->
        <p
          v-if="impl.produces"
          class="ref-impl-note"
          v-html="`Produces ${linkify(impl.produces)}.`"
        ></p>
        <!-- eslint-disable-next-line vue/no-v-html -- prose is trusted local data -->
        <p v-if="impl.note" class="ref-impl-note" v-html="linkify(impl.note)"></p>
      </div>
    </template>

    <p v-if="entry.seeAlso?.length" class="ref-see">
      See also:
      <template v-for="(n, i) in entry.seeAlso" :key="n">
        <a :href="`/reference/symbol/${n}`"
          ><code>{{ n }}</code></a
        ><span v-if="i < entry.seeAlso.length - 1">, </span>
      </template>
    </p>
  </div>
  <div v-else>
    <p>Unknown reference entry: {{ name }}</p>
  </div>
</template>

<style scoped>
.ref-sig code {
  font-size: 1.05rem;
}
.ref-signatures {
  margin: 0.75rem 0;
}
.ref-signature {
  margin: 0.4rem 0;
}
.ref-signature code {
  font-size: 0.95rem;
}
.ref-sig-desc {
  margin-left: 0.5rem;
  color: var(--vp-c-text-2);
}
.ref-details {
  margin: 1rem 0;
}
.ref-details summary {
  cursor: pointer;
  font-weight: 600;
  color: var(--vp-c-text-2);
  font-size: 0.9rem;
}
/* Collapsible example sections; no chrome, aligned with the examples. */
.ref-section {
  margin: 0.5rem 0;
}
.ref-section > summary.ref-category {
  cursor: pointer;
  list-style: none;
}
.ref-section > summary.ref-category::-webkit-details-marker {
  display: none;
}
.ref-section > summary.ref-category::before {
  content: "▾";
  display: inline-block;
  margin-right: 0.35rem;
  color: var(--vp-c-text-3);
  transition: transform 0.15s;
}
.ref-section:not([open]) > summary.ref-category::before {
  transform: rotate(-90deg);
}
.ref-anchor {
  margin-left: 0.35rem;
  color: var(--vp-c-brand-1);
  opacity: 0;
  text-decoration: none;
  transition: opacity 0.15s;
}
.ref-section > summary:hover .ref-anchor,
.ref-anchor:focus {
  opacity: 1;
}
.ref-section {
  scroll-margin-top: calc(var(--vp-nav-height) + 1rem);
}
.ref-section.is-bare > summary {
  display: none;
}
.ref-details ul {
  margin: 0.5rem 0 0;
  padding-left: 1.1rem;
}
.ref-details li {
  margin: 0.3rem 0;
  color: var(--vp-c-text-2);
}
.ref-stub {
  color: var(--vp-c-text-2);
  font-size: 0.85rem;
  border-left: 3px solid var(--vp-c-divider);
  padding-left: 0.75rem;
}
.ref-meta {
  color: var(--vp-c-text-2);
  font-size: 0.9rem;
}
.ref-example {
  margin: 0.75rem 0;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
}
/* Snapshot assertion failed -- result diverged from the pinned expected value. */
.ref-example.is-mismatch {
  border-color: var(--vp-c-danger-1, #c0392b);
  background: var(--vp-c-danger-soft, rgba(192, 57, 43, 0.08));
}
/* compute-engine returned a diagnostic (an Error atom) rather than a value. */
.ref-example.is-diagnostic {
  border-color: #d9931a;
  background: rgba(217, 147, 26, 0.08);
}
/* A borrowed target compute-engine doesn't reproduce yet -- a capability gap. */
.ref-example.is-planned {
  border-style: dashed;
  border-color: var(--vp-c-brand-1);
}
.ref-planned-badge {
  margin-left: 0.5rem;
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  background: var(--vp-c-brand-soft, rgba(100, 108, 255, 0.14));
  color: var(--vp-c-brand-1);
  font-size: 0.72rem;
  white-space: nowrap;
}
/* A deliberate, documented divergence from Wolfram behaviour (result is correct). */
.ref-example.is-edited {
  border-style: dashed;
}
/* The caption describes the original, not the edit. */
.ref-example.is-edited .ref-caption {
  opacity: 0.45;
}
.ref-example.is-divergent {
  border-left: 3px solid #d9931a;
}
.ref-divergent-badge {
  margin-left: 0.5rem;
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  background: rgba(217, 147, 26, 0.14);
  color: #b7791f;
  font-size: 0.72rem;
  white-space: nowrap;
}
.ref-divergence-note {
  margin: 0.35rem 0 0;
  color: var(--vp-c-text-2);
  font-size: 0.8rem;
}
.ref-category {
  margin: 1.5rem 0 0.5rem;
  font-size: 1rem;
  color: var(--vp-c-text-1);
}
.ref-examples-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.ref-view {
  display: flex;
  gap: 0.6rem;
  font-size: 0.75rem;
}
.ref-view button {
  color: var(--vp-c-text-3);
  cursor: pointer;
}
.ref-view button:hover {
  color: var(--vp-c-brand-1);
}
.ref-caption {
  margin: 0 0 0.4rem;
  color: var(--vp-c-text-2);
  font-size: 0.85rem;
}
/* Implementation rows: what the head is made of, one per implementation. */
.ref-badge {
  display: inline-block;
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  font-family: var(--vp-font-family-mono);
  font-size: 0.72rem;
  line-height: 1.5;
  white-space: nowrap;
  background: var(--vp-c-default-soft);
  color: var(--vp-c-text-2);
}
.ref-badge.ref-origin {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}
.ref-badge.is-primitive {
  background: rgba(217, 147, 26, 0.14);
  color: #b7791f;
}
.ref-primitive {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  color: var(--vp-c-text-2);
  font-size: 0.9rem;
}
.ref-impl {
  margin: 0.75rem 0;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
}
/* The reference row is the specification -- set it apart from the rows checked against it. */
.ref-impl[data-origin="reference"] {
  border-color: var(--vp-c-brand-1);
}
.ref-impl-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.5rem;
}
.ref-impl-form {
  font-size: 0.85rem;
}
.ref-impl-source {
  color: var(--vp-c-text-2);
  font-size: 0.8rem;
}
.ref-impl notatio-out {
  display: block;
  margin: 0.5rem 0 0;
}
.ref-impl notatio-code {
  display: block;
  margin: 0.5rem 0 0;
}
.ref-impl-note {
  margin: 0.35rem 0 0;
  color: var(--vp-c-text-2);
  font-size: 0.8rem;
}
</style>
