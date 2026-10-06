<script setup lang="ts">
// What the manifest says of a head: the table `About(Head)` answers, read without a kernel.
import type { Description, Overload } from "@enumeratio/manifest";
import { describe } from "@enumeratio/manifest";
import { ref, watch } from "vue";

const props = defineProps<{ name: string }>();

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
        <tr v-if="about.examples">
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
  margin-right: 0.75rem;
}
.about-note {
  color: var(--vp-c-text-3);
  font-size: 0.8rem;
}
</style>
