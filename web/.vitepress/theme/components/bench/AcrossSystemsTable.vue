<script setup lang="ts">
import { computed } from "vue";
import {
  byName,
  chainedRatio,
  directRatio,
  formatNs,
  formatRatio,
  geomean,
  okIntersection,
  statusReason,
} from "./stats.ts";
import type { BenchSystem, CaseResult, IndexRun, Report } from "./types.ts";

// One column: a system's report, plus (for a cross-job compare column) the run it actually
// came from and that run's own ts report, so its ratio can be chained through the ts anchor.
interface Column {
  readonly system: BenchSystem;
  readonly report: Report | undefined;
  readonly run: IndexRun;
  readonly chainTs?: Report; // this column's own run's ts report, when chaining across jobs
}

const props = defineProps<{
  caseNames: readonly string[];
  baseline: BenchSystem;
  baselineReport: Report | undefined;
  columns: readonly Column[];
  primaryJob: string;
}>();

const baselineByName = computed(() => byName(props.baselineReport?.results ?? []));

const okNames = computed(() => {
  const bySystem = new Map(props.columns.map((c) => [c.system, byName(c.report?.results ?? [])] as const));
  bySystem.set(props.baseline, baselineByName.value);
  const systems = [props.baseline, ...props.columns.map((c) => c.system)];
  return new Set(okIntersection(props.caseNames, bySystem, systems));
});

// A chained column's ratio anchors through ts on both sides, so it's only meaningful when
// the baseline itself is ts (enforced by the parent: chaining is disabled otherwise).
function ratioFor(col: Column, result: CaseResult): number | undefined {
  const baseResult = baselineByName.value.get(result.name);
  if (!baseResult?.median || !result.median) return undefined;
  if (col.chainTs) {
    const ownTs = byName(col.chainTs.results).get(result.name);
    if (!ownTs?.median) return undefined;
    return chainedRatio(result.median, ownTs.median, baseResult.median, baseResult.median);
  }
  return directRatio(result.median, baseResult.median);
}

const geomeans = computed(() => {
  const out = new Map<BenchSystem, number>();
  for (const col of props.columns) {
    const byN = byName(col.report?.results ?? []);
    const ratios: number[] = [];
    for (const name of okNames.value) {
      const result = byN.get(name);
      if (!result) continue;
      const r = ratioFor(col, result);
      if (r !== undefined) ratios.push(r);
    }
    out.set(col.system, geomean(ratios));
  }
  return out;
});
</script>

<template>
  <div class="bench-across">
    <p class="bench-intersection-note">
      {{ okNames.size }} of {{ caseNames.length }} benchmarks ok across every selected system (baseline
      <code>{{ baseline }}</code
      >).
    </p>
    <div class="bench-table-scroll">
      <table class="bench-table">
        <thead>
          <tr>
            <th scope="col">benchmark</th>
            <th scope="col">{{ baseline }} (baseline)</th>
            <th v-for="col in columns" :key="col.system" scope="col">
              {{ col.system }}
              <span v-if="col.chainTs" class="bench-chained" title="ratio chained through each run's own ts median">
                chained via ts
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="name in caseNames" :key="name">
            <td>
              <a :href="`/reference/symbol/${name.split('/')[0]}#example/${name.split('/').slice(1).join('/')}`">
                <code>{{ name }}</code>
              </a>
            </td>
            <td>
              <template v-if="baselineByName.get(name)?.status === 'ok'">
                {{ formatNs(baselineByName.get(name)!.median!) }}
              </template>
              <template v-else>
                <span
                  class="bench-status"
                  :title="
                    statusReason(baselineByName.get(name)?.status ?? 'unsupported', baselineByName.get(name)?.reason)
                  "
                  >{{ baselineByName.get(name)?.status ?? "unsupported" }}</span
                >
              </template>
            </td>
            <td v-for="col in columns" :key="col.system">
              <template v-if="byName(col.report?.results ?? []).get(name)?.status === 'ok'">
                {{ formatNs(byName(col.report?.results ?? []).get(name)!.median!) }}
                <span
                  v-if="ratioFor(col, byName(col.report?.results ?? []).get(name)!) !== undefined"
                  class="bench-ratio"
                  :class="{
                    faster: ratioFor(col, byName(col.report?.results ?? []).get(name)!)! < 1,
                    slower: ratioFor(col, byName(col.report?.results ?? []).get(name)!)! > 1,
                  }"
                >
                  {{ formatRatio(ratioFor(col, byName(col.report?.results ?? []).get(name)!)!) }}
                </span>
              </template>
              <template v-else>
                <span
                  class="bench-status"
                  :title="
                    statusReason(
                      byName(col.report?.results ?? []).get(name)?.status ?? 'unsupported',
                      byName(col.report?.results ?? []).get(name)?.reason,
                    )
                  "
                  >{{ byName(col.report?.results ?? []).get(name)?.status ?? "unsupported" }}</span
                >
              </template>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">geometric mean of ratios</th>
            <td>1.00×</td>
            <td v-for="col in columns" :key="col.system">
              <template v-if="Number.isFinite(geomeans.get(col.system))">
                {{ formatRatio(geomeans.get(col.system)!) }}
              </template>
              <template v-else>—</template>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
</template>

<style scoped>
.bench-intersection-note {
  color: var(--vp-c-text-2);
  font-size: 0.85rem;
  margin: 0 0 0.6rem;
}
.bench-table-scroll {
  overflow-x: auto;
}
.bench-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
  white-space: nowrap;
}
.bench-table th,
.bench-table td {
  border-bottom: 1px solid var(--vp-c-divider);
  padding: 0.35rem 0.6rem;
  text-align: left;
}
.bench-table thead th {
  color: var(--vp-c-text-3);
  font-size: 0.72rem;
  font-weight: 600;
}
.bench-table tfoot th,
.bench-table tfoot td {
  font-weight: 600;
  border-top: 2px solid var(--vp-c-divider);
  border-bottom: none;
}
.bench-chained {
  display: block;
  font-weight: 400;
  font-size: 0.68rem;
  color: var(--vp-c-text-3);
  text-transform: none;
}
.bench-status {
  color: var(--vp-c-text-3);
  font-style: italic;
  cursor: help;
}
.bench-ratio {
  margin-left: 0.35rem;
  font-variant-numeric: tabular-nums;
}
.bench-ratio.faster {
  color: var(--vp-c-green-1);
}
.bench-ratio.faster::before {
  content: "▼ ";
}
.bench-ratio.slower {
  color: var(--vp-c-red-1);
}
.bench-ratio.slower::before {
  content: "▲ ";
}
</style>
