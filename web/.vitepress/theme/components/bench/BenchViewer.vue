<script setup lang="ts">
// The benchmark viewer (design/benchmarking.md §8): across-systems comparison for one run,
// a system's median over time, and the support matrix. Data is fetched at runtime from
// `bench-data` (see ./data.ts); `?data=` overrides the base for local fixtures/previews.
import { computed, onMounted, ref, watch } from "vue";
import AcrossSystemsTable from "./AcrossSystemsTable.vue";
import { baseUrlFrom, HttpError, loadIndex, loadPlan, loadReport } from "./data.ts";
import OverTimeChart, { type TimePoint } from "./OverTimeChart.vue";
import { geomean, normaliseToFirst, sameFormula } from "./stats.ts";
import SupportMatrix from "./SupportMatrix.vue";
import type { BenchIndex, BenchSystem, IndexRun, Plan, Report } from "./types.ts";

type LoadState = "loading" | "empty" | "error" | "ready";
type View = "across" | "time" | "matrix";

const state = ref<LoadState>("loading");
const errorMessage = ref("");
const index = ref<BenchIndex | null>(null);
const baseUrl = ref("");

// ---- URL query state (run, systems, baseline, view, cmpRun, cmpSys, tsys, tbench) ----
const runId = ref("");
const view = ref<View>("across");
const selectedSystems = ref<BenchSystem[]>([]);
const baseline = ref<BenchSystem>("ts");
const compareRunId = ref("");
const compareSystem = ref<BenchSystem | "">("");
const timeSystem = ref<BenchSystem>("ts");
const timeBench = ref("");

function readQuery(): void {
  if (typeof window === "undefined") return;
  const p = new URLSearchParams(window.location.search);
  if (p.get("run")) runId.value = p.get("run")!;
  if (p.get("view")) view.value = p.get("view") as View;
  if (p.get("systems")) selectedSystems.value = p.get("systems")!.split(",") as BenchSystem[];
  if (p.get("baseline")) baseline.value = p.get("baseline") as BenchSystem;
  if (p.get("cmpRun")) compareRunId.value = p.get("cmpRun")!;
  if (p.get("cmpSys")) compareSystem.value = p.get("cmpSys") as BenchSystem;
  if (p.get("tsys")) timeSystem.value = p.get("tsys") as BenchSystem;
  if (p.get("tbench")) timeBench.value = p.get("tbench")!;
}

function writeQuery(): void {
  if (typeof window === "undefined") return;
  const p = new URLSearchParams(window.location.search);
  const data = p.get("data");
  const next = new URLSearchParams();
  if (data) next.set("data", data);
  if (runId.value) next.set("run", runId.value);
  next.set("view", view.value);
  if (selectedSystems.value.length) next.set("systems", selectedSystems.value.join(","));
  next.set("baseline", baseline.value);
  if (compareRunId.value) next.set("cmpRun", compareRunId.value);
  if (compareSystem.value) next.set("cmpSys", compareSystem.value);
  if (view.value === "time") {
    next.set("tsys", timeSystem.value);
    if (timeBench.value) next.set("tbench", timeBench.value);
  }
  const url = `${window.location.pathname}?${next.toString()}`;
  window.history.replaceState(null, "", url);
}

const runs = computed<readonly IndexRun[]>(() => index.value?.runs ?? []);
const currentRun = computed<IndexRun | undefined>(() => runs.value.find((r) => r.id === runId.value));
const allCaseNames = ref<string[]>([]);
const plan = ref<Plan | null>(null);
const reports = ref<Map<BenchSystem, Report>>(new Map());
const compareReport = ref<Report | null>(null);
const compareTsReport = ref<Report | null>(null);
const reportsLoading = ref(false);

/** Each case's formula in the selected run: what another run must have timed to compare. */
const formulas = computed(() => new Map(plan.value?.cases.map((c) => [c.name, c.formula]) ?? []));

async function loadRun(run: IndexRun): Promise<void> {
  reportsLoading.value = true;
  try {
    const p = await loadPlan(baseUrl.value, run.id);
    plan.value = p;
    allCaseNames.value = p.cases.map((c) => c.name);
    const systemsToLoad = new Set<BenchSystem>([baseline.value, ...selectedSystems.value]);
    const loaded = await Promise.all(
      [...systemsToLoad].map(async (sys) => [sys, await loadReport(baseUrl.value, run.id, sys)] as const),
    );
    reports.value = new Map(loaded);

    if (compareRunId.value && compareSystem.value) {
      const cmpRun = runs.value.find((r) => r.id === compareRunId.value);
      if (cmpRun) {
        compareReport.value = sameFormula(
          await loadReport(baseUrl.value, cmpRun.id, compareSystem.value),
          formulas.value,
        );
        compareTsReport.value = cmpRun.systems.includes("ts")
          ? sameFormula(await loadReport(baseUrl.value, cmpRun.id, "ts"), formulas.value)
          : null;
      }
    } else {
      compareReport.value = null;
      compareTsReport.value = null;
    }
  } finally {
    reportsLoading.value = false;
  }
}

// `flush: "post"` plus the `ready` guard keeps mount's own explicit loadRun() call (below)
// from racing a duplicate one fired by this watcher during initial ref setup.
const ready = ref(false);
watch(
  [runId, selectedSystems, baseline, compareRunId, compareSystem],
  () => {
    if (ready.value && currentRun.value) void loadRun(currentRun.value);
  },
  { flush: "post" },
);

// Columns for the across-systems table: the run's own selected systems, plus (if set) one
// column pulled from a different run, chained through ts when its job differs.
const columns = computed(() => {
  const own = selectedSystems.value
    .filter((s) => s !== baseline.value)
    .map((s) => ({ system: s, report: reports.value.get(s), run: currentRun.value! }));
  if (compareRunId.value && compareSystem.value && compareReport.value) {
    const cmpRun = runs.value.find((r) => r.id === compareRunId.value);
    const differentJob = cmpRun && currentRun.value && cmpRun.job !== currentRun.value.job;
    own.push({
      system: compareSystem.value,
      report: compareReport.value,
      run: cmpRun!,
      ...(differentJob && compareTsReport.value ? { chainTs: compareTsReport.value } : {}),
    });
  }
  return own;
});

async function selectRun(run: IndexRun): Promise<void> {
  runId.value = run.id;
  selectedSystems.value = [...run.systems];
  if (!run.systems.includes(baseline.value)) baseline.value = run.systems[0] ?? "ts";
  await loadRun(run);
}

// ---- over-time view ----
const timePoints = ref<TimePoint[]>([]);
const timeLoading = ref(false);
// A tag averages its cases instead of showing one (design/benchmarking.md §8).
const timeTag = ref("");
const allTags = computed(() => [...new Set(plan.value?.cases.flatMap((c) => c.tags ?? []))].sort());
const tagCases = computed(
  () => new Set(plan.value?.cases.filter((c) => c.tags?.includes(timeTag.value)).map((c) => c.name)),
);

async function loadTimeSeries(): Promise<void> {
  if (!timeBench.value && !timeTag.value) return;
  timeLoading.value = true;
  try {
    const eligibleRuns = runs.value.filter((r) => r.systems.includes(timeSystem.value));
    const perRun = await Promise.all(
      eligibleRuns.map(async (r) => {
        const report = await loadReport(baseUrl.value, r.id, timeSystem.value);
        const byN = new Map(sameFormula(report, formulas.value).results.map((res) => [res.name, res] as const));
        const caseNames = timeTag.value ? [...byN.keys()].filter((n) => tagCases.value.has(n)) : [timeBench.value];
        const oks = caseNames.map((n) => byN.get(n)).filter((r): r is Report["results"][number] => r?.status === "ok");
        return { run: r, oks };
      }),
    );

    if (timeTag.value) {
      // Per case: normalise its series to its own first run, then geomean across cases per run.
      const byCase = new Map<string, number[]>();
      const caseNamesSeen = new Set<string>();
      for (const { oks } of perRun) for (const o of oks) caseNamesSeen.add(o.name);
      for (const name of caseNamesSeen) {
        byCase.set(
          name,
          normaliseToFirst(perRun.map((pr) => pr.oks.find((o) => o.name === name)?.median ?? Number.NaN)),
        );
      }
      timePoints.value = perRun.map((pr, i) => {
        const ratios = [...byCase.values()].map((series) => series[i]).filter((x) => Number.isFinite(x));
        const g = geomean(ratios);
        return {
          runId: pr.run.id,
          date: pr.run.date,
          sha: pr.run.sha,
          url: pr.run.url,
          median: g,
          q1: g,
          q3: g,
          fingerprint: pr.run.machine,
        };
      });
    } else {
      timePoints.value = perRun
        .filter((pr) => pr.oks[0])
        .map((pr) => ({
          runId: pr.run.id,
          date: pr.run.date,
          sha: pr.run.sha,
          url: pr.run.url,
          median: pr.oks[0]!.median!,
          q1: pr.oks[0]!.q1 ?? pr.oks[0]!.median!,
          q3: pr.oks[0]!.q3 ?? pr.oks[0]!.median!,
          fingerprint: pr.run.machine,
        }));
    }
  } finally {
    timeLoading.value = false;
  }
}

watch([timeSystem, timeBench, timeTag], () => {
  if (view.value === "time") void loadTimeSeries();
});
watch(view, (v) => {
  if (v === "time" && (timeBench.value || timeTag.value)) void loadTimeSeries();
});

watch([runId, view, selectedSystems, baseline, compareRunId, compareSystem], writeQuery, {
  deep: true,
});

onMounted(async () => {
  readQuery();
  baseUrl.value = baseUrlFrom(window.location.search);
  try {
    const idx = await loadIndex(baseUrl.value);
    if (idx.runs.length === 0) {
      state.value = "empty";
      return;
    }
    index.value = idx;
    const latest = idx.runs[idx.runs.length - 1]!;
    const chosen = runs.value.find((r) => r.id === runId.value) ?? latest;
    if (!selectedSystems.value.length) selectedSystems.value = [...chosen.systems];
    runId.value = chosen.id;
    if (!chosen.systems.includes(baseline.value))
      baseline.value = chosen.systems.includes("ts") ? "ts" : chosen.systems[0]!;
    if (!timeBench.value) timeSystem.value = chosen.systems[0] ?? "ts";
    await loadRun(chosen);
    if (view.value === "time" && timeBench.value) await loadTimeSeries();
    state.value = "ready";
    ready.value = true;
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) {
      state.value = "empty";
    } else {
      state.value = "error";
      errorMessage.value = e instanceof Error ? e.message : String(e);
    }
  }
});
</script>

<template>
  <div class="bench-viewer">
    <div v-if="state === 'loading'" class="bench-panel">Loading benchmark runs…</div>

    <div v-else-if="state === 'empty'" class="bench-panel">
      <p>No benchmark runs published yet.</p>
      <p>
        Once the nightly job lands its first run, this page will show medians across systems, a support matrix, and
        trends over time. See
        <a
          href="https://github.com/enumeratio/enumeratio/blob/main/design/benchmarking.md"
          target="_blank"
          rel="noopener"
          >design/benchmarking.md</a
        >
        for the plan.
      </p>
    </div>

    <div v-else-if="state === 'error'" class="bench-panel bench-error">
      <p>Couldn't load benchmark data: {{ errorMessage }}</p>
      <p>
        See
        <a
          href="https://github.com/enumeratio/enumeratio/blob/main/design/benchmarking.md"
          target="_blank"
          rel="noopener"
          >design/benchmarking.md</a
        >
        for how this page is meant to work.
      </p>
    </div>

    <div v-else class="bench-panel">
      <div class="bench-controls">
        <label>
          run
          <select
            :value="runId"
            @change="selectRun(runs.find((r) => r.id === ($event.target as HTMLSelectElement).value)!)"
          >
            <option v-for="r in [...runs].reverse()" :key="r.id" :value="r.id">
              {{ new Date(r.date).toLocaleDateString() }} · {{ r.job }} · {{ r.sha.slice(0, 7) }}
            </option>
          </select>
        </label>

        <div class="bench-tabs" role="tablist">
          <button type="button" :aria-selected="view === 'across'" @click="view = 'across'">across systems</button>
          <button type="button" :aria-selected="view === 'time'" @click="view = 'time'">over time</button>
          <button type="button" :aria-selected="view === 'matrix'" @click="view = 'matrix'">support matrix</button>
        </div>
      </div>

      <section v-if="view === 'across'" aria-label="across systems, one run">
        <fieldset class="bench-fieldset">
          <legend>systems</legend>
          <label v-for="sys in currentRun?.systems ?? []" :key="sys" class="bench-checkbox">
            <input type="checkbox" :value="sys" v-model="selectedSystems" />
            {{ sys }}
          </label>
        </fieldset>
        <label class="bench-inline">
          baseline
          <select v-model="baseline">
            <option v-for="sys in currentRun?.systems ?? []" :key="sys" :value="sys">
              {{ sys }}
            </option>
          </select>
        </label>

        <details class="bench-compare">
          <summary>compare against another run (e.g. a weekly Wolfram run)</summary>
          <label class="bench-inline">
            run
            <select v-model="compareRunId">
              <option value="">none</option>
              <option v-for="r in [...runs].reverse().filter((r) => r.id !== runId)" :key="r.id" :value="r.id">
                {{ new Date(r.date).toLocaleDateString() }} · {{ r.job }}
              </option>
            </select>
          </label>
          <label v-if="compareRunId" class="bench-inline">
            system
            <select v-model="compareSystem">
              <option value="">choose…</option>
              <option v-for="sys in runs.find((r) => r.id === compareRunId)?.systems ?? []" :key="sys" :value="sys">
                {{ sys }}
              </option>
            </select>
          </label>
        </details>

        <p v-if="reportsLoading" class="bench-loading">Loading…</p>
        <AcrossSystemsTable
          v-else-if="currentRun"
          :case-names="allCaseNames"
          :baseline="baseline"
          :baseline-report="reports.get(baseline)"
          :columns="columns"
          :primary-job="currentRun.job"
        />
      </section>

      <section v-else-if="view === 'time'" aria-label="over time, one system">
        <label class="bench-inline">
          system
          <select v-model="timeSystem">
            <option v-for="sys in [...new Set(runs.flatMap((r) => r.systems))]" :key="sys" :value="sys">
              {{ sys }}
            </option>
          </select>
        </label>
        <label class="bench-inline">
          benchmark
          <select v-model="timeBench">
            <option value="">choose…</option>
            <option v-for="name in allCaseNames" :key="name" :value="name">{{ name }}</option>
          </select>
        </label>
        <label class="bench-inline">
          or a tag
          <select v-model="timeTag">
            <option value="">none</option>
            <option v-for="tag in allTags" :key="tag" :value="tag">{{ tag }}</option>
          </select>
        </label>
        <p v-if="timeTag" class="bench-note">
          Each case in the tag is normalised to its own first run, then the cases are averaged (geometric mean) per run.
        </p>

        <p v-if="timeLoading" class="bench-loading">Loading…</p>
        <p v-else-if="!timeBench && !timeTag" class="bench-loading">Pick a benchmark or a tag to see its trend.</p>
        <OverTimeChart v-else :points="timePoints" />
      </section>

      <section v-else-if="view === 'matrix'" aria-label="support matrix">
        <p v-if="reportsLoading" class="bench-loading">Loading…</p>
        <SupportMatrix v-else-if="plan && currentRun" :plan="plan" :systems="currentRun.systems" />
      </section>
    </div>
  </div>
</template>

<style scoped>
.bench-viewer {
  margin: 1rem 0;
}
.bench-panel {
  overflow-x: hidden; /* the page never scrolls sideways; tables scroll in their own box */
}
.bench-error {
  color: var(--vp-c-text-1);
}
.bench-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}
.bench-controls select {
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  padding: 0.25rem 0.5rem;
  font-size: 0.85rem;
}
.bench-tabs {
  display: flex;
  gap: 0.4rem;
}
.bench-tabs button {
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  border-radius: 999px;
  padding: 0.25rem 0.75rem;
  font-size: 0.8rem;
  cursor: pointer;
}
.bench-tabs button[aria-selected="true"] {
  background: var(--vp-c-brand-1);
  color: var(--vp-c-white, #fff);
  border-color: var(--vp-c-brand-1);
}
.bench-fieldset {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  padding: 0.4rem 0.8rem;
  margin: 0 0 0.6rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem 1rem;
}
.bench-fieldset legend {
  font-size: 0.72rem;
  color: var(--vp-c-text-3);
  padding: 0 0.4rem;
}
.bench-checkbox {
  font-size: 0.85rem;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}
.bench-inline {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  margin: 0 1rem 0.6rem 0;
}
.bench-compare {
  margin: 0.4rem 0 0.8rem;
  font-size: 0.85rem;
  color: var(--vp-c-text-2);
}
.bench-loading,
.bench-note {
  color: var(--vp-c-text-3);
  font-size: 0.85rem;
}
</style>
