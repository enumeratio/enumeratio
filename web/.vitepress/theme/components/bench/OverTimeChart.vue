<script setup lang="ts">
import { computed, ref } from "vue";
import { logTicks } from "./stats.ts";

export interface TimePoint {
  readonly runId: string;
  readonly date: string;
  readonly sha: string;
  readonly url?: string;
  readonly median: number;
  readonly q1: number;
  readonly q3: number;
  readonly fingerprint: string;
}

const props = defineProps<{ points: readonly TimePoint[]; unit?: string }>();

const W = 760;
const H = 280;
const PAD_L = 56;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 32;

const sorted = computed(() => [...props.points].sort((a, b) => a.date.localeCompare(b.date)));

const times = computed(() => sorted.value.map((p) => new Date(p.date).getTime()));
const tMin = computed(() => Math.min(...times.value));
const tMax = computed(() => Math.max(...times.value));

const yMin = computed(() => Math.min(...sorted.value.map((p) => p.q1)) * 0.9);
const yMax = computed(() => Math.max(...sorted.value.map((p) => p.q3)) * 1.1);

function xOf(t: number): number {
  const span = tMax.value - tMin.value || 1;
  return PAD_L + ((t - tMin.value) / span) * (W - PAD_L - PAD_R);
}
function yOf(v: number): number {
  const lo = Math.log10(yMin.value || 1);
  const hi = Math.log10(yMax.value || 10);
  const span = hi - lo || 1;
  return PAD_T + (1 - (Math.log10(Math.max(v, 1e-9)) - lo) / span) * (H - PAD_T - PAD_B);
}

const ticks = computed(() => logTicks(yMin.value, yMax.value));

const fingerprints = computed(() => [...new Set(sorted.value.map((p) => p.fingerprint))]);
const palette = ["var(--vp-c-brand-1)", "var(--vp-c-green-1)", "var(--vp-c-red-1)", "var(--vp-c-yellow-1)"];
const shapes = ["circle", "square", "triangle", "diamond"] as const;
function colorFor(fp: string): string {
  return palette[fingerprints.value.indexOf(fp) % palette.length];
}
function shapeFor(fp: string): (typeof shapes)[number] {
  return shapes[fingerprints.value.indexOf(fp) % shapes.length];
}

const linePath = computed(() =>
  sorted.value.map((p, i) => `${i === 0 ? "M" : "L"}${xOf(new Date(p.date).getTime())},${yOf(p.median)}`).join(" "),
);

const bandPath = computed(() => {
  if (sorted.value.length === 0) return "";
  const top = sorted.value.map((p) => `${xOf(new Date(p.date).getTime())},${yOf(p.q3)}`);
  const bottom = [...sorted.value].reverse().map((p) => `${xOf(new Date(p.date).getTime())},${yOf(p.q1)}`);
  return `M${top.join(" L")} L${bottom.join(" L")} Z`;
});

const hovered = ref<TimePoint | null>(null);
const hoveredPos = ref({ x: 0, y: 0 });
function onHover(p: TimePoint, evt: MouseEvent): void {
  hovered.value = p;
  const rect = (evt.currentTarget as SVGElement).ownerSVGElement?.getBoundingClientRect();
  hoveredPos.value = { x: evt.clientX - (rect?.left ?? 0), y: evt.clientY - (rect?.top ?? 0) };
}

function shortSha(sha: string): string {
  return sha.slice(0, 7);
}
function commitUrl(p: TimePoint): string {
  return p.url ?? `https://github.com/enumeratio/enumeratio/commit/${p.sha}`;
}
</script>

<template>
  <div class="bench-time-chart">
    <svg :viewBox="`0 0 ${W} ${H}`" role="img" aria-label="median duration over time">
      <!-- y gridlines + ticks (log scale) -->
      <g v-for="t in ticks" :key="t">
        <line :x1="PAD_L" :x2="W - PAD_R" :y1="yOf(t)" :y2="yOf(t)" class="bench-gridline" />
        <text :x="PAD_L - 6" :y="yOf(t)" class="bench-axis-label" text-anchor="end" dominant-baseline="middle">
          {{
            t >= 1e9
              ? `${(t / 1e9).toFixed(0)}s`
              : t >= 1e6
                ? `${(t / 1e6).toFixed(0)}ms`
                : t >= 1e3
                  ? `${(t / 1e3).toFixed(0)}µs`
                  : `${t}ns`
          }}
        </text>
      </g>
      <!-- x-axis endpoints -->
      <text :x="PAD_L" :y="H - 8" class="bench-axis-label" text-anchor="start">
        {{ sorted[0] ? new Date(sorted[0].date).toLocaleDateString() : "" }}
      </text>
      <text :x="W - PAD_R" :y="H - 8" class="bench-axis-label" text-anchor="end">
        {{ sorted[sorted.length - 1] ? new Date(sorted[sorted.length - 1].date).toLocaleDateString() : "" }}
      </text>

      <path :d="bandPath" class="bench-iqr-band" />
      <path :d="linePath" class="bench-line" />

      <!-- each point is a link to its commit (click), plus a title for a native tooltip and
           a richer floating one on hover (see below) -->
      <a
        v-for="p in sorted"
        :key="p.runId"
        :href="commitUrl(p)"
        target="_blank"
        rel="noopener"
        @mouseenter="onHover(p, $event)"
        @mouseleave="hovered = null"
      >
        <title>
          {{ new Date(p.date).toLocaleDateString() }} · {{ shortSha(p.sha) }} · median {{ p.median.toFixed(0) }}ns
        </title>
        <circle
          v-if="shapeFor(p.fingerprint) === 'circle'"
          :cx="xOf(new Date(p.date).getTime())"
          :cy="yOf(p.median)"
          r="4"
          :fill="colorFor(p.fingerprint)"
        />
        <rect
          v-else-if="shapeFor(p.fingerprint) === 'square'"
          :x="xOf(new Date(p.date).getTime()) - 3.5"
          :y="yOf(p.median) - 3.5"
          width="7"
          height="7"
          :fill="colorFor(p.fingerprint)"
        />
        <polygon
          v-else-if="shapeFor(p.fingerprint) === 'triangle'"
          :points="`${xOf(new Date(p.date).getTime())},${yOf(p.median) - 5} ${xOf(new Date(p.date).getTime()) - 4.5},${yOf(p.median) + 4} ${xOf(new Date(p.date).getTime()) + 4.5},${yOf(p.median) + 4}`"
          :fill="colorFor(p.fingerprint)"
        />
        <polygon
          v-else
          :points="`${xOf(new Date(p.date).getTime())},${yOf(p.median) - 5} ${xOf(new Date(p.date).getTime()) - 5},${yOf(p.median)} ${xOf(new Date(p.date).getTime())},${yOf(p.median) + 5} ${xOf(new Date(p.date).getTime()) + 5},${yOf(p.median)}`"
          :fill="colorFor(p.fingerprint)"
        />
      </a>
    </svg>

    <div v-if="hovered" class="bench-tooltip" :style="{ left: `${hoveredPos.x}px`, top: `${hoveredPos.y}px` }">
      <div>{{ new Date(hovered.date).toLocaleString() }}</div>
      <div>
        <a :href="commitUrl(hovered)" target="_blank" rel="noopener">{{ shortSha(hovered.sha) }}</a>
      </div>
      <div>
        median {{ hovered.median.toFixed(0) }} ns · q1 {{ hovered.q1.toFixed(0) }} · q3
        {{ hovered.q3.toFixed(0) }}
      </div>
    </div>

    <ul class="bench-legend" aria-label="machine fingerprint legend">
      <li v-for="fp in fingerprints" :key="fp">
        <span class="bench-legend-swatch" :style="{ background: colorFor(fp) }" />
        {{ fp.replace("sha256:", "") }} ({{ shapeFor(fp) }})
      </li>
    </ul>
  </div>
</template>

<style scoped>
.bench-time-chart {
  position: relative;
  margin: 0.5rem 0;
}
.bench-time-chart svg {
  width: 100%;
  height: auto;
  overflow: visible;
}
.bench-gridline {
  stroke: var(--vp-c-divider);
  stroke-width: 1;
}
.bench-axis-label {
  fill: var(--vp-c-text-3);
  font-size: 9px;
}
.bench-iqr-band {
  fill: var(--vp-c-brand-1);
  opacity: 0.12;
  stroke: none;
}
.bench-line {
  fill: none;
  stroke: var(--vp-c-brand-1);
  stroke-width: 1.5;
}
.bench-tooltip {
  position: absolute;
  transform: translate(-50%, -110%);
  background: var(--vp-c-bg-elv);
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  padding: 0.35rem 0.5rem;
  font-size: 0.75rem;
  pointer-events: none;
  white-space: nowrap;
  box-shadow: var(--vp-shadow-2);
}
.bench-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  list-style: none;
  padding: 0;
  margin: 0.4rem 0 0;
  font-size: 0.78rem;
  color: var(--vp-c-text-2);
}
.bench-legend-swatch {
  display: inline-block;
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 2px;
  margin-right: 0.3rem;
  vertical-align: -1px;
}
</style>
