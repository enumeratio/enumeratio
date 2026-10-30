<script setup lang="ts">
// One statistic on one carrier, or one map out of one: what it is, how it is called, and what
// FindStat says of it. A name on two carriers is two pages (distinct implementations).
import { computed, ref } from "vue";
import {
  defaultRows,
  glyphSvg,
  lastRowSvg,
  MAP_TABLE_ROWS,
  mapBadges,
  showJson,
  triangleLines,
  triangleSizes,
  type MapRow,
  type TriangleLine,
} from "@enumeratio/frontend/core";
import type { Triangle } from "@enumeratio/frontend/core";
import type { MapExplorer } from "@enumeratio/frontend/explorer";
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
  /** Where a statistic's carrier has its elements picked from: collection template, size bounds, glyph. A map's comes from `mapExplorer`. */
  picker?: { carrier: string; template: string; size: { min: number; max: number; start: number }; glyph?: string };
  /** Where a map is explored: its source collection, size bounds and glyphs (maps only; absent for a frontier map). */
  mapExplorer?: MapExplorer;
  /** The statistics on a map's source and target carriers, for transport (maps only). */
  sourceStatistics?: readonly string[];
  targetStatistics?: readonly string[];
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

// The live cell starts on FindStat's sample; picking another element of the carrier replaces it.
const pickerSpec = computed(() => {
  if (props.picker) return props.picker;
  const explorer = props.mapExplorer;
  if (!explorer) return undefined;
  const { template, maxSize, start, sourceGlyph } = explorer;
  return {
    carrier: props.field.carrier,
    template,
    size: { min: 1, max: maxSize, start },
    ...(sourceGlyph !== undefined && { glyph: sourceGlyph }),
  };
});
const picked = ref<unknown>();
const shown = computed(() => picked.value ?? props.live);
function onPick(event: Event): void {
  const { element } = (event as CustomEvent<{ element: unknown }>).detail;
  picked.value = [isStatistic.value ? "CombinatorialStat" : "CombinatorialMap", element, `'${props.field.name}'`];
}

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
const same = ref<
  | { matches: readonly string[]; unconfirmed: readonly string[]; checked: number; total: number; stopped: boolean }
  | undefined
>();

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

// The map explorer: a table of elements and their images at one small size, and the map's
// properties over the sizes up to a few. Both computed here, on demand, at sizes the caps allow.
const mapSize = ref(props.mapExplorer?.start ?? 1);
const mapSizes = ref(Math.min(props.mapExplorer?.maxSize ?? 1, 5));
interface MapTableRow {
  from: string;
  to: string;
  fromSvg?: string;
  toSvg?: string;
}
const mapTable = ref<{ size: number; count: number; rows: MapTableRow[] } | undefined>();
const mapRows = ref<MapRow[]>([]);
const mapBusy = ref<string | undefined>();
const mapFailure = ref<string | undefined>();
const badges = computed(() => mapBadges(mapRows.value));

async function showMapTable(): Promise<void> {
  const explorer = props.mapExplorer;
  if (!explorer) return;
  mapBusy.value = "table";
  mapFailure.value = undefined;
  try {
    const { mapAtSize } = await import("@enumeratio/components");
    const answer = await mapAtSize(explorer, mapSize.value);
    if (!answer.ok) {
      mapTable.value = undefined;
      mapFailure.value = answer.reason;
      return;
    }
    mapTable.value = {
      size: mapSize.value,
      count: answer.elements.length,
      rows: answer.elements.slice(0, MAP_TABLE_ROWS).map((element, i) => {
        const image = answer.images[i];
        const fromSvg = glyphSvg(explorer.sourceGlyph, element);
        const toSvg = image === undefined ? undefined : glyphSvg(explorer.targetGlyph, image);
        return {
          from: showJson(element),
          to: image === undefined ? "no image" : showJson(image),
          ...(fromSvg !== undefined && { fromSvg }),
          ...(toSvg !== undefined && { toSvg }),
        };
      }),
    };
  } catch (err) {
    mapFailure.value = err instanceof Error ? err.message : String(err);
  } finally {
    mapBusy.value = undefined;
  }
}

async function checkMapProperties(): Promise<void> {
  const explorer = props.mapExplorer;
  if (!explorer) return;
  mapBusy.value = "properties";
  mapFailure.value = undefined;
  try {
    const { mapProperties } = await import("@enumeratio/components");
    mapRows.value = await mapProperties(explorer, triangleSizes(1, Math.min(mapSizes.value, explorer.maxSize)), {
      progress: (n) => (mapBusy.value = `properties, size ${n}`),
    });
  } catch (err) {
    mapFailure.value = err instanceof Error ? err.message : String(err);
  } finally {
    mapBusy.value = undefined;
  }
}

// Transport: a target statistic S pulled back along the map (the distribution of S(map(x)) over the
// source), and the source statistics that share it at the sizes computed.
const transportStat = ref(props.targetStatistics?.[0] ?? "");
const transportSizes = ref(Math.min(props.mapExplorer?.maxSize ?? 1, 5));
const transportTriangle = ref<Triangle | undefined>();
const transportLines = computed<TriangleLine[]>(() =>
  transportTriangle.value ? triangleLines(transportTriangle.value) : [],
);
const transportBusy = ref<string | undefined>();
const transportFailure = ref<string | undefined>();
const transported = ref<typeof same.value>();

async function findTransported(): Promise<void> {
  const explorer = props.mapExplorer;
  if (!explorer || !transportStat.value) return;
  transportBusy.value = "distribution";
  transportFailure.value = undefined;
  transported.value = undefined;
  transportTriangle.value = undefined;
  try {
    const { transportTriangle: triangleOf, findTransports } = await import("@enumeratio/components");
    const subject = await triangleOf(
      explorer,
      transportStat.value,
      triangleSizes(1, Math.min(transportSizes.value, explorer.maxSize)),
      { progress: (n) => (transportBusy.value = `distribution, size ${n}`) },
    );
    transportTriangle.value = subject;
    transported.value = await findTransports(explorer, subject, props.sourceStatistics ?? [], {
      progress: (checked, total, phase) =>
        (transportBusy.value = `${phase === "screen" ? "screening" : "confirming"} ${checked}/${total}`),
    });
  } catch (err) {
    transportFailure.value = err instanceof Error ? err.message : String(err);
  } finally {
    transportBusy.value = undefined;
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
      progress: (checked, total, phase) =>
        (busy.value = `same, ${phase === "screen" ? "screening" : "confirming"} ${checked}/${total}`),
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

    <section v-if="live || pickerSpec" class="field-live">
      <h2>Live</h2>
      <ClientOnly>
        <notatio-cell
          v-if="shown"
          :key="toJson(shown)"
          format="mathjson"
          :value="toJson(shown)"
          :resolveHead.prop="resolveHead"
        ></notatio-cell>
        <template v-if="pickerSpec">
          <p class="field-note">Pick another element of {{ field.carrier }}: its size, then its place in the list.</p>
          <notatio-element-picker
            :template="pickerSpec.template"
            :carrier="field.carrier"
            :glyph="pickerSpec.glyph"
            :size="pickerSpec.size.start"
            :size-min="pickerSpec.size.min"
            :size-max="pickerSpec.size.max"
            @notatio-element-pick="onPick"
          ></notatio-element-picker>
        </template>
      </ClientOnly>
    </section>

    <section v-if="mapExplorer" class="field-explorer">
      <h2>Explore</h2>
      <p class="field-note">
        Each element of <code>{{ field.carrier }}</code> at a size, and its image, applied in your browser; sizes past
        {{ mapExplorer.maxSize }} are not offered.
      </p>
      <p>
        <label>
          Size
          <input v-model.number="mapSize" type="number" min="1" :max="mapExplorer.maxSize" :disabled="!!mapBusy" />
        </label>
        <button type="button" :disabled="!!mapBusy" @click="showMapTable">Show the table</button>
        <span v-if="mapBusy === 'table'" class="field-note"> working…</span>
      </p>
      <table v-if="mapTable" class="field-sample field-map-table">
        <thead>
          <tr>
            <th>Element</th>
            <th>Image</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in mapTable.rows" :key="i">
            <td>
              <span v-if="row.fromSvg" class="field-glyph" v-html="row.fromSvg"></span>
              <code>{{ row.from }}</code>
            </td>
            <td>
              <span v-if="row.toSvg" class="field-glyph" v-html="row.toSvg"></span>
              <code>{{ row.to }}</code>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="mapTable && mapTable.count > mapTable.rows.length" class="field-note">
        The first {{ mapTable.rows.length }} of {{ mapTable.count }} elements at size {{ mapTable.size }}.
      </p>

      <h3>Properties</h3>
      <p>
        <label>
          Sizes 1 to
          <input v-model.number="mapSizes" type="number" min="1" :max="mapExplorer.maxSize" :disabled="!!mapBusy" />
        </label>
        <button type="button" :disabled="!!mapBusy" @click="checkMapProperties">
          {{ mapRows.length ? "Check again" : "Check the properties" }}
        </button>
        <span v-if="mapBusy?.startsWith('properties')" class="field-note"> working: {{ mapBusy }}…</span>
      </p>
      <p v-if="mapFailure" class="field-note">{{ mapFailure }}</p>
      <p v-if="badges.length">
        <span v-for="b in badges" :key="b" class="field-chip">{{ b }}</span>
        <span class="field-note">as computed on these sizes, not proved.</span>
      </p>
      <table v-if="mapRows.length" class="field-sample">
        <thead>
          <tr>
            <th>n</th>
            <th>Elements</th>
            <th>Injective</th>
            <th>Bijection</th>
            <th v-if="mapExplorer.selfMap">Involution</th>
            <th v-if="mapExplorer.selfMap">Order</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in mapRows" :key="row.n">
            <td>{{ row.n }}</td>
            <template v-if="row.ok">
              <td>{{ row.check.count }}</td>
              <td>{{ row.check.injective ? "yes" : "no" }}</td>
              <td>{{ row.check.bijection === undefined ? "not decided" : row.check.bijection ? "yes" : "no" }}</td>
              <td v-if="mapExplorer.selfMap">
                {{ row.check.involution === undefined ? "–" : row.check.involution ? "yes" : "no" }}
              </td>
              <td v-if="mapExplorer.selfMap">{{ row.check.order ?? "–" }}</td>
            </template>
            <td v-else :colspan="mapExplorer.selfMap ? 5 : 3" class="field-note">{{ row.reason }}</td>
          </tr>
        </tbody>
      </table>

      <h3>Transport a statistic</h3>
      <p class="field-note">
        Pick a statistic on <code>{{ field.to }}</code
        >. Its distribution over the images of <code>{{ field.carrier }}</code> at each size is computed, and compared
        with the {{ sourceStatistics?.length ?? 0 }} statistics on <code>{{ field.carrier }}</code
        >: those that share it are the ones the map sends it to, as far as the sizes computed show.
      </p>
      <p v-if="!targetStatistics?.length" class="field-note">No statistic is declared on {{ field.to }}.</p>
      <p v-else>
        <label>
          Statistic
          <select v-model="transportStat" :disabled="!!transportBusy">
            <option v-for="s in targetStatistics" :key="s" :value="s">{{ s }}</option>
          </select>
        </label>
        <label>
          Sizes 1 to
          <input
            v-model.number="transportSizes"
            type="number"
            min="3"
            :max="mapExplorer.maxSize"
            :disabled="!!transportBusy"
          />
        </label>
        <button type="button" :disabled="!!transportBusy || !sourceStatistics?.length" @click="findTransported">
          Find where it goes
        </button>
        <span v-if="transportBusy" class="field-note"> working: {{ transportBusy }}…</span>
      </p>
      <p v-if="transportFailure" class="field-note">{{ transportFailure }}</p>
      <table v-if="transportLines.length" class="field-sample field-triangle">
        <thead>
          <tr>
            <th>n</th>
            <th>Coefficients of {{ transportStat }} over the images</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="line in transportLines" :key="line.n">
            <td>{{ line.n }}</td>
            <td v-if="'coefficients' in line">
              <code>{{ line.coefficients.join(", ") }}</code>
              <span v-if="line.low !== 0" class="field-note"> from q^{{ line.low }}</span>
            </td>
            <td v-else class="field-note">{{ line.reason }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="transported">
        <template v-if="transported.matches.length">
          {{ transportStat }} of the image is equidistributed with
          <template v-for="(m, i) in transported.matches" :key="m"
            ><a :href="`/reference/statistic/${field.carrier}/${m}`">{{ m }}</a
            ><span v-if="i < transported.matches.length - 1">, </span></template
          >
          on the sizes computed, not proved.
        </template>
        <template v-else-if="!transported.unconfirmed.length && !transported.stopped"
          >No statistic on {{ field.carrier }} has that distribution on the sizes computed.</template
        >
        <template v-if="transported.unconfirmed.length">
          Equal at the small sizes, not checked further:
          <template v-for="(m, i) in transported.unconfirmed" :key="m"
            ><a :href="`/reference/statistic/${field.carrier}/${m}`">{{ m }}</a
            ><span v-if="i < transported.unconfirmed.length - 1">, </span></template
          >.
        </template>
        <span v-if="transported.stopped" class="field-note">
          Stopped after {{ transported.checked }} of {{ transported.total }}: the time budget ran out.</span
        >
      </p>
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
          <template v-else-if="!same.unconfirmed.length"
            >No other statistic on {{ field.carrier }} has the same distribution.</template
          >
          <template v-if="same.unconfirmed.length">
            Equal at the small sizes, not checked further:
            <template v-for="(m, i) in same.unconfirmed" :key="m"
              ><a :href="`/reference/statistic/${field.carrier}/${m}`">{{ m }}</a
              ><span v-if="i < same.unconfirmed.length - 1">, </span></template
            >.
          </template>
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
.field-distribution,
.field-explorer {
  margin-top: 1.5rem;
}
.field-distribution input,
.field-explorer input {
  width: 4rem;
}
.field-glyph {
  display: inline-block;
  max-width: 5rem;
  margin-right: 0.5rem;
  vertical-align: middle;
}
.field-glyph :deep(svg) {
  max-width: 100%;
  height: auto;
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
