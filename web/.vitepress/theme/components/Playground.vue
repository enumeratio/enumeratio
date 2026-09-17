<script setup lang="ts">
import { type BoxedExpression, type ComputeEngine, loadEngine } from "@enumeratio/notatio";
import { onMounted, ref, shallowRef, watch } from "vue";

type Mode = "latex" | "mathjson";

const mode = ref<Mode>("latex");
const source = ref("\\frac{1}{2} + \\frac{1}{3}");
const error = ref("");
const parsed = ref("");
const serialized = ref("");
const evaluated = ref("");
const numeric = ref("");

const ce = shallowRef<ComputeEngine>();

const examples: Record<Mode, string> = {
  latex: "\\frac{1}{2} + \\frac{1}{3}",
  mathjson: '["Add", ["Rational", 1, 2], ["Rational", 1, 3]]',
};

function pretty(expr: BoxedExpression): string {
  return JSON.stringify(expr.json, null, 2);
}

function run(): void {
  const engine = ce.value;
  if (!engine) return;
  error.value = "";
  parsed.value = serialized.value = evaluated.value = numeric.value = "";

  const text = source.value.trim();
  if (!text) return;

  try {
    const box = mode.value === "latex" ? engine.parse(text) : engine.box(JSON.parse(text));

    parsed.value = pretty(box);
    serialized.value = box.latex;

    const result = box.evaluate();
    evaluated.value = pretty(result);
    numeric.value = box.N().latex;
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  }
}

function setMode(next: Mode): void {
  if (mode.value === next) return;
  mode.value = next;
  source.value = examples[next];
}

onMounted(async () => {
  ce.value = await loadEngine();
  run();
});

watch([source, mode], run);
</script>

<template>
  <div class="ce-playground">
    <div class="ce-modes">
      <button :class="{ active: mode === 'latex' }" type="button" @click="setMode('latex')">
        LaTeX
      </button>
      <button :class="{ active: mode === 'mathjson' }" type="button" @click="setMode('mathjson')">
        MathJSON
      </button>
    </div>

    <textarea
      v-model="source"
      class="ce-input"
      rows="4"
      spellcheck="false"
      :placeholder="mode === 'latex' ? 'Enter LaTeX…' : 'Enter MathJSON…'"
    />

    <p v-if="!ce" class="ce-status">Loading compute-engine…</p>
    <p v-else-if="error" class="ce-error">{{ error }}</p>

    <div v-if="ce && !error" class="ce-grid">
      <section>
        <h4>Parsed MathJSON</h4>
        <pre>{{ parsed }}</pre>
      </section>
      <section>
        <h4>Serialized LaTeX</h4>
        <pre>{{ serialized }}</pre>
      </section>
      <section>
        <h4>Evaluated MathJSON</h4>
        <pre>{{ evaluated }}</pre>
      </section>
      <section>
        <h4>Numeric (N)</h4>
        <pre>{{ numeric }}</pre>
      </section>
    </div>
  </div>
</template>

<style scoped>
.ce-playground {
  margin: 1.5rem 0;
}
.ce-modes {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}
.ce-modes button {
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  font-size: 0.85rem;
  cursor: pointer;
}
.ce-modes button.active {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.ce-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  font-family: var(--vp-font-family-mono);
  font-size: 0.9rem;
  resize: vertical;
}
.ce-status {
  color: var(--vp-c-text-3);
}
.ce-error {
  color: var(--vp-c-danger-1);
  font-family: var(--vp-font-family-mono);
  white-space: pre-wrap;
}
.ce-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}
.ce-grid h4 {
  margin: 0 0 0.25rem;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--vp-c-text-2);
}
.ce-grid pre {
  margin: 0;
  padding: 0.75rem;
  border-radius: 8px;
  background: var(--vp-c-bg-alt);
  overflow-x: auto;
  font-size: 0.82rem;
  line-height: 1.4;
}
</style>
