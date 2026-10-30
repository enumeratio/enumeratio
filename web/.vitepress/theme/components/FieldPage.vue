<script setup lang="ts">
// One statistic on one carrier, or one map out of one: what it is, how it is called, and what
// FindStat says of it. A name on two carriers is two pages (distinct implementations).
import { computed, ref } from "vue";
import { defaultRows, lastRowSvg, triangleLines, triangleSizes, type TriangleLine } from "@enumeratio/frontend/core";
import type { Triangle } from "@enumeratio/frontend/core";
import { getEntry, resolveHead } from "../../data/reference.ts";
import { renderBlock, renderInline } from "../../prose.ts";
import type { Field } from "../../data/carrier-fields.ts";

const props = defineProps<{
  field: Field;
  live?: unknown;
  siblings?: readonly Field[];
  /** Where the statistic's distributions are tallied (statistics only; absent when the carrier has no sized collection). */
  distribution?: { collection: string; template: string; maxSize: number };
  /** The other statistics on this carrier, for "same distribution as". */
  carrierStatistics?: readonly string[];
}>();

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

// The distribution triangle and its equidistributed siblings: computed here, on demand, by the
// page's engine. The components package is only ever imported inside these handlers (SSR-safe).
const rows = ref(props.distribution ? defaultRows(props.distribution.maxSize) : 0);
const triangle = ref<Triangle | undefined>();
const lines = computed<TriangleLine[]>(() => (triangle.value ? triangleLines(triangle.value) : []));
const chart = computed(() =>
  triangle.value ? lastRowSvg(triangle.value, `${props.field.name}, size ${rows.value}`) : undefined,
);
const busy = ref<string | undefined>();
const failure = ref<string | undefined>();
const same = ref<{ matches: readonly string[]; checked: number; total: number; stopped: boolean } | undefined>();

async function computeTriangle(): Promise<void> {
  if (!props.distribution) return;
  busy.value = "triangle";
  failure.value = undefined;
  same.value = undefined;
  try {
    const { distributionTriangle } = await import("@enumeratio/components");
    triangle.value = await distributionTriangle(
      props.distribution.template,
      props.field.name,
      triangleSizes(1, Math.min(rows.value, props.distribution.maxSize)),
      { maxSize: props.distribution.maxSize, progress: (n) => (busy.value = `triangle, size ${n}`) },
    );
  } catch (err) {
    failure.value = err instanceof Error ? err.message : String(err);
  } finally {
    busy.value = undefined;
  }
}

async function findSame(): Promise<void> {
  if (!props.distribution || !triangle.value) return;
  busy.value = "same";
  failure.value = undefined;
  try {
    const { findEquidistributed } = await import("@enumeratio/components");
    same.value = await findEquidistributed(props.distribution.template, triangle.value, props.carrierStatistics ?? [], {
      maxSize: props.distribution.maxSize,
      progress: (checked, total) => (busy.value = `same ${checked}/${total}`),
    });
  } catch (err) {
    failure.value = err instanceof Error ? err.message : String(err);
  } finally {
    busy.value = undefined;
  }
}
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

    <section v-if="isStatistic && distribution" class="field-distribution">
      <h2>Distribution</h2>
      <p class="field-note">
        Over <code>{{ distribution.collection }}</code> at each size, tallied here in your browser; sizes past
        {{ distribution.maxSize }} are not offered.
      </p>
      <p>
        <label>
          Sizes 1 to
          <input v-model.number="rows" type="number" min="1" :max="distribution.maxSize" :disabled="!!busy" />
        </label>
        <button type="button" :disabled="!!busy" @click="computeTriangle">
          {{ triangle ? "Recompute" : "Compute the triangle" }}
        </button>
        <span v-if="busy" class="field-note"> working: {{ busy }}…</span>
      </p>
      <p v-if="failure" class="field-note">{{ failure }}</p>
      <table v-if="lines.length" class="field-sample field-triangle">
        <thead>
          <tr>
            <th>n</th>
            <th>Coefficients</th>
            <th>Generating polynomial</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="line in lines" :key="line.n">
            <td>{{ line.n }}</td>
            <template v-if="'coefficients' in line">
              <td>
                <code>{{ line.coefficients.join(", ") }}</code>
                <span v-if="line.low !== 0" class="field-note"> from q^{{ line.low }}</span>
              </td>
              <td>
                <code>{{ line.polynomial }}</code>
              </td>
            </template>
            <td v-else colspan="2" class="field-note">{{ line.reason }}</td>
          </tr>
        </tbody>
      </table>
      <div v-if="chart" class="field-chart" v-html="chart"></div>
      <template v-if="triangle && lines.some((l) => 'coefficients' in l)">
        <p>
          <button type="button" :disabled="!!busy || !carrierStatistics?.length" @click="findSame">
            Same distribution as…
          </button>
          <span class="field-note">
            compared with the {{ carrierStatistics?.length ?? 0 }} other statistics on {{ field.carrier }}.</span
          >
        </p>
        <p v-if="same">
          <template v-if="same.matches.length">
            Equidistributed with
            <template v-for="(m, i) in same.matches" :key="m"
              ><a :href="`/reference/statistic/${field.carrier}/${m}`">{{ m }}</a
              ><span v-if="i < same.matches.length - 1">, </span></template
            >.
          </template>
          <template v-else>No other statistic on {{ field.carrier }} has the same distribution.</template>
          <span v-if="same.stopped" class="field-note">
            Stopped after {{ same.checked }} of {{ same.total }}: the time budget ran out.</span
          >
        </p>
      </template>
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
      <p v-if="ref.agreement" class="field-note">
        Matched by value: our map agrees with FindStat's image on each of the {{ ref.agreement.compared }} rows of size
        at most 6 we can read ({{ ref.agreement.skipped }} unread; its table has {{ ref.agreement.rows }} rows).
        <span v-if="ref.valueNote">{{ ref.valueNote }}</span>
      </p>
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
.field-distribution {
  margin-top: 1.5rem;
}
.field-distribution input {
  width: 4rem;
}
.field-triangle td {
  vertical-align: top;
}
.field-chart {
  max-width: 28rem;
}
.field-sample {
  display: table;
  font-size: 0.85rem;
}
</style>
