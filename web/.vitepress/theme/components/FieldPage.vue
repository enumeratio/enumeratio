<script setup lang="ts">
// One statistic on one carrier, or one map out of one: what it is, how it is called, and what
// FindStat says of it. A name on two carriers is two pages (distinct implementations).
import { computed } from "vue";
import { getEntry, resolveHead } from "../../data/reference.ts";
import { renderBlock, renderInline } from "../../prose.ts";
import type { Field } from "../../data/carrier-fields.ts";

const props = defineProps<{ field: Field; live?: unknown; siblings?: readonly Field[] }>();

const isStatistic = computed(() => props.field.kind === "statistic");
const call = computed(() =>
  isStatistic.value ? `CombinatorialStat(x, "${props.field.name}")` : `CombinatorialMap(x, "${props.field.name}")`,
);
const carrierHref = (carrier: string): string | undefined =>
  getEntry(carrier) ? `/reference/symbol/${carrier}` : undefined;
const headHref = computed(() => (getEntry(props.field.name) ? `/reference/symbol/${props.field.name}` : undefined));
const toJson = (expr: unknown): string => JSON.stringify(expr);
const prose = (text: string): string => renderBlock(text);
const inline = (text?: string): string => renderInline(text ?? "");
</script>

<template>
  <div class="field-page">
    <p v-if="field.summary" class="field-summary" v-html="inline(field.summary)"></p>
    <p v-if="field.kind === 'map'" class="field-meta">
      <a v-if="carrierHref(field.carrier)" :href="carrierHref(field.carrier)">{{ field.carrier }}</a
      ><span v-else>{{ field.carrier }}</span>
      →
      <a v-if="field.to && carrierHref(field.to)" :href="carrierHref(field.to)">{{ field.to }}</a
      ><span v-else>{{ field.to }}</span>
      <span v-for="law in field.laws" :key="law" class="field-chip">{{ law }}</span>
    </p>
    <p v-else class="field-meta">
      On
      <a v-if="carrierHref(field.carrier)" :href="carrierHref(field.carrier)">{{ field.carrier }}</a
      ><span v-else>{{ field.carrier }}</span>
    </p>
    <p v-if="field.frontier" class="field-note">Named and typed, but not defined yet.</p>
    <p v-if="field.note" class="field-note" v-html="inline(field.note)"></p>

    <p>
      Called as <code>{{ call }}</code
      >. <a v-if="headHref" :href="headHref">The head's page</a><span v-if="headHref"> has its examples.</span>
    </p>

    <section v-if="live" class="field-live">
      <h2>Live</h2>
      <ClientOnly>
        <notatio-cell format="mathjson" :value="toJson(live)" :resolveHead.prop="resolveHead"></notatio-cell>
      </ClientOnly>
    </section>

    <section v-if="siblings?.length">
      <h2>Also {{ isStatistic ? "on" : "from" }}</h2>
      <p>
        The same name {{ isStatistic ? "on" : "out of" }} other carriers, each its own implementation:
        <template v-for="(s, i) in siblings" :key="s.carrier"
          ><a :href="s.href">{{ s.carrier }}</a
          ><span v-if="i < siblings.length - 1">, </span></template
        >.
      </p>
    </section>

    <section v-for="ref in field.findstat" :key="ref.id" class="field-findstat">
      <h2>
        FindStat <a :href="ref.url">{{ ref.id }}</a>
      </h2>
      <p v-if="ref.title" class="field-title" v-html="inline(ref.title)"></p>
      <p v-if="ref.properties?.length">
        <span v-for="p in ref.properties" :key="p" class="field-chip">{{ p }}</span>
        <span class="field-note">as FindStat records them, checked by FindStat's contributors.</span>
      </p>
      <div
        v-if="ref.description && ref.description !== ref.title"
        class="field-description"
        v-html="prose(ref.description)"
      ></div>
      <table v-if="ref.sample?.length" class="field-sample">
        <thead>
          <tr>
            <th>Object</th>
            <th>{{ isStatistic ? "Value" : "Image" }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="[object, value] in ref.sample" :key="object">
            <td>
              <code>{{ object }}</code>
            </td>
            <td>
              <code>{{ value }}</code>
            </td>
          </tr>
        </tbody>
      </table>
      <p class="field-note">
        Data from <a href="https://www.findstat.org">FindStat</a>, the combinatorial statistic finder; the page at
        <a :href="ref.url">{{ ref.url.replace("https://www.", "") }}</a> has the rest.
      </p>
    </section>
  </div>
</template>

<style scoped>
.field-meta {
  color: var(--vp-c-text-2);
}
.field-note {
  color: var(--vp-c-text-3);
  font-size: 0.85rem;
}
.field-chip {
  display: inline-block;
  margin: 0 0.3rem 0.15rem 0;
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  background: var(--vp-c-default-soft);
  color: var(--vp-c-text-2);
  font-family: var(--vp-font-family-mono);
  font-size: 0.72rem;
}
.field-live,
.field-findstat {
  margin-top: 1.5rem;
}
.field-sample {
  display: table;
  font-size: 0.85rem;
}
</style>
