<script setup lang="ts">
// What the manifest says of a head: the table `About(Head)` answers, read without a kernel.
import type { Description, Overload } from "@enumeratio/manifest";
import { describe } from "@enumeratio/manifest";
import {
  groupBySystem,
  isCrosswalkSystem,
  type ReferenceEntry,
  type ResolvedReference,
  SOURCES,
} from "@enumeratio/reference";
import { computed, ref, watch } from "vue";

const props = defineProps<{
  name: string;
  /** The page's own data, summarized Information-style; nothing is shown of what it lacks. */
  entry?: ReferenceEntry;
  references?: readonly ResolvedReference[];
}>();

const about = ref<Description>();
const failed = ref(false);

// Asked once, when the panel opens.
const open = ref(false);
watch(
  [open, () => props.name],
  async ([isOpen, name]) => {
    if (!isOpen) return;
    about.value = undefined;
    failed.value = false;
    try {
      about.value = await describe(name);
    } catch {
      failed.value = true;
    }
  },
  { immediate: true },
);

// The summary reads what the page already holds: no manifest, so it is there as the panel opens.
const VERDICTS = [
  ["agree", "agree"],
  ["disagree", "differ"],
  ["inconclusive", "unevaluated"],
  ["error", "error"],
] as const;
const examples = computed(() => props.entry?.examples.length ?? 0);
const checked = computed(() => {
  const bySystem = new Map<string, Record<string, number>>();
  for (const ex of props.entry?.examples ?? []) {
    for (const [system, run] of Object.entries(ex.others ?? {})) {
      const counts = bySystem.get(system) ?? {};
      counts[run.verdict] = (counts[run.verdict] ?? 0) + 1;
      bySystem.set(system, counts);
    }
  }
  return [...bySystem].map(([system, counts]) => ({
    label: isCrosswalkSystem(system) ? SOURCES[system].label : system,
    verdicts: VERDICTS.filter(([verdict]) => counts[verdict]).map(([verdict, word]) => ({
      verdict,
      text: `${counts[verdict]} ${word}`,
    })),
  }));
});
const crosswalk = computed(() =>
  groupBySystem(props.references ?? []).map((g) => ({
    label: g.label,
    count: g.references.length,
    href: g.references.find((r) => r.href)?.href,
  })),
);
const summarized = computed(() => examples.value > 0 || checked.value.length > 0 || crosswalk.value.length > 0);

const ENGINE = "compute-engine";
const findStatUrl = (id: string): string =>
  `https://www.findstat.org/${id.startsWith("Mp") ? "MapsDatabase" : "StatisticsDatabase"}/${id}`;

/** Where an overload applies, when it applies to less than everything. */
const scope = (o: Overload): string | undefined => {
  const parts = [...(o.on ?? []), ...(o.types ?? []), ...(o.symbols ?? [])];
  return parts.length > 0 ? `only ${parts.join(", ")}` : undefined;
};
const defaults = (d?: Readonly<Record<string, unknown>>): [string, string][] =>
  Object.entries(d ?? {}).map(([key, value]) => [key, JSON.stringify(value)]);
</script>

<template>
  <details id="about" class="about" @toggle="open = ($event.target as HTMLDetailsElement).open">
    <summary>About</summary>
    <table v-if="summarized" class="about-table about-summary">
      <tbody>
        <tr v-if="examples">
          <th>Examples</th>
          <td>{{ examples }}</td>
        </tr>
        <tr v-if="checked.length">
          <th>Checked against</th>
          <td>
            <span v-for="c in checked" :key="c.label" class="about-default"
              >{{ c.label }}
              <span
                v-for="v in c.verdicts"
                :key="v.verdict"
                class="about-chip about-verdict"
                :class="`is-${v.verdict}`"
                >{{ v.text }}</span
              ></span
            >
          </td>
        </tr>
        <tr v-if="crosswalk.length">
          <th>Crosswalk</th>
          <td>
            <template v-for="c in crosswalk" :key="c.label"
              ><a v-if="c.href" :href="c.href" target="_blank" rel="noopener noreferrer" class="about-chip"
                >{{ c.label }}<span v-if="c.count > 1"> ×{{ c.count }}</span></a
              ><span v-else class="about-chip"
                >{{ c.label }}<span v-if="c.count > 1"> ×{{ c.count }}</span></span
              ></template
            >
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="failed" class="about-note">The manifest has nothing on {{ name }}.</p>
    <p v-else-if="open && !about" class="about-note">Reading the manifest…</p>
    <table v-else-if="about" class="about-table">
      <tbody>
        <tr>
          <th>Kind</th>
          <td>{{ about.kind }}</td>
        </tr>
        <tr v-if="about.signature ?? about.type">
          <th>{{ about.signature ? "Signature" : "Type" }}</th>
          <td>
            <code>{{ about.signature ?? about.type }}</code>
          </td>
        </tr>
        <tr v-if="about.params?.length">
          <th>Parameters</th>
          <td>
            <code v-for="(p, i) in about.params" :key="p"
              >{{ p }}<span v-if="i < about.params.length - 1">, </span></code
            >
          </td>
        </tr>
        <tr v-if="defaults(about.defaults).length">
          <th>Defaults</th>
          <td>
            <span v-for="[key, value] in defaults(about.defaults)" :key="key" class="about-default"
              ><code>{{ key }}</code> = <code>{{ value }}</code></span
            >
          </td>
        </tr>
        <tr v-if="about.attributes?.length">
          <th>Attributes</th>
          <td>
            <span v-for="a in about.attributes" :key="a" class="about-chip">{{ a }}</span>
          </td>
        </tr>
        <tr v-if="about.overloads?.length">
          <th>Overloads</th>
          <td>
            <ul class="about-overloads">
              <li v-for="(o, i) in about.overloads" :key="i">
                <span class="about-chip" :class="{ 'is-engine': o.package === ENGINE }">{{ o.package }}</span>
                <code v-if="o.type">{{ o.type }}</code>
                <span v-if="scope(o)" class="about-note"> · {{ scope(o) }}</span>
                <span v-if="o.overrides" class="about-note"> · replaces {{ o.overrides }}'s</span>
              </li>
            </ul>
          </td>
        </tr>
        <tr v-if="about.documented?.length">
          <th>Documented in</th>
          <td>
            <a v-for="pkg in about.documented" :key="pkg" :href="`/docs/${pkg}/`" class="about-chip">{{ pkg }}</a>
          </td>
        </tr>
        <tr v-if="about.triggers?.length">
          <th>LaTeX</th>
          <td>
            <code v-for="(t, i) in about.triggers" :key="t"
              >{{ t }}<span v-if="i < about.triggers.length - 1">, </span></code
            >
          </td>
        </tr>
        <tr v-if="about.findstat?.length">
          <th>FindStat</th>
          <td>
            <a v-for="f in about.findstat" :key="f.id" :href="findStatUrl(f.id)" class="about-chip"
              >{{ f.id }}<span v-if="f.on"> on {{ f.on }}</span></a
            >
          </td>
        </tr>
        <tr v-if="about.examples && !examples">
          <th>Examples</th>
          <td>{{ about.examples }} held to its record</td>
        </tr>
        <tr v-if="about.namespace">
          <th>Namespace</th>
          <td>
            <code>{{ about.namespace }}</code
            ><span v-if="about.pin">
              pinned <code>{{ about.pin }}</code></span
            ><span v-if="about.head">
              as <code>{{ about.head }}</code></span
            >
          </td>
        </tr>
      </tbody>
    </table>
  </details>
</template>

<style scoped>
.about {
  margin: 1rem 0;
}
.about summary {
  cursor: pointer;
  font-weight: 600;
  color: var(--vp-c-text-2);
  font-size: 0.9rem;
}
.about-table {
  display: table;
  margin: 0.5rem 0 0;
  font-size: 0.85rem;
}
.about-table th {
  width: 7.5rem;
  padding: 0.25rem 0.75rem 0.25rem 0;
  text-align: left;
  vertical-align: top;
  white-space: nowrap;
  font-weight: 500;
  color: var(--vp-c-text-3);
  border: 0;
  background: none;
}
.about-table td {
  padding: 0.25rem 0;
  border: 0;
}
.about-table tr {
  background: none;
}
.about-chip {
  display: inline-block;
  margin: 0 0.3rem 0.15rem 0;
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  background: var(--vp-c-default-soft);
  color: var(--vp-c-text-2);
  font-family: var(--vp-font-family-mono);
  font-size: 0.72rem;
  line-height: 1.5;
  text-decoration: none;
}
.about-chip.is-engine {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}
a.about-chip:hover {
  color: var(--vp-c-brand-1);
}
.about-overloads {
  margin: 0;
  padding: 0;
  list-style: none;
}
.about-overloads li {
  margin: 0.15rem 0;
}
.about-default {
  display: inline-block;
  margin-right: 0.75rem;
  white-space: nowrap;
}
.about-verdict.is-agree {
  color: var(--vp-c-green-1);
}
.about-verdict.is-disagree,
.about-verdict.is-error {
  color: var(--vp-c-danger-1);
}
.about-note {
  color: var(--vp-c-text-3);
  font-size: 0.8rem;
}
</style>
