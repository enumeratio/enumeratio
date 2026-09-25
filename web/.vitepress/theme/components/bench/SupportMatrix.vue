<script setup lang="ts">
import type { BenchSystem, Plan } from "./types.ts";

const props = defineProps<{ plan: Plan; systems: readonly BenchSystem[] }>();

function cellText(caseName: string, sys: BenchSystem): string {
  const cell = props.plan.cases.find((c) => c.name === caseName)?.systems[sys];
  if (!cell) return "—";
  if ("sources" in cell) return "supported";
  if (cell.reason === "unmapped") return `unmapped: ${cell.missing.join(", ")}`;
  if (cell.reason === "denied") return `denied: ${cell.note}`;
  return cell.reason;
}

function isSupported(caseName: string, sys: BenchSystem): boolean {
  const cell = props.plan.cases.find((c) => c.name === caseName)?.systems[sys];
  return !!cell && "sources" in cell;
}
</script>

<template>
  <div class="bench-matrix-scroll">
    <table class="bench-matrix">
      <thead>
        <tr>
          <th scope="col">benchmark</th>
          <th v-for="sys in systems" :key="sys" scope="col">{{ sys }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="c in plan.cases" :key="c.name">
          <td>
            <a
              :href="`/reference/symbol/${c.name.split('/')[0]}#example/${c.name.split('/').slice(1).join('/')}`"
            >
              <code>{{ c.name }}</code>
            </a>
          </td>
          <td
            v-for="sys in systems"
            :key="sys"
            :class="{ yes: isSupported(c.name, sys), no: !isSupported(c.name, sys) }"
          >
            <span :title="cellText(c.name, sys)">{{ isSupported(c.name, sys) ? "✓" : "✗" }}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.bench-matrix-scroll {
  overflow-x: auto;
}
.bench-matrix {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
  white-space: nowrap;
}
.bench-matrix th,
.bench-matrix td {
  border-bottom: 1px solid var(--vp-c-divider);
  padding: 0.35rem 0.6rem;
  text-align: left;
}
.bench-matrix thead th {
  color: var(--vp-c-text-3);
  font-size: 0.72rem;
  font-weight: 600;
}
.bench-matrix td.yes span {
  color: var(--vp-c-green-1);
}
.bench-matrix td.no span {
  color: var(--vp-c-text-3);
  cursor: help;
}
</style>
