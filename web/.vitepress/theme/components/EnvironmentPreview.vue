<script setup lang="ts">
// One expression, reduced for an environment and rendered by the ordinary components:
// pick print and the controls become small multiples; pick a pipe and they pin. The
// page's own print is the same thing done for real -- `matchMedia("print")` flips the
// environment when the browser prints, so what comes out of the printer is the
// reduction, not a picture of a slider.
import {
  browserEnvironment,
  ENVIRONMENTS,
  type Environment,
  mediaSignals,
  reduce,
} from "@enumeratio/notatio";
import { parseNotatio, serializeNotatio } from "@enumeratio/formats/notatio";
import { computed, onMounted, onUnmounted, ref } from "vue";

const props = defineProps<{ expr: string; env?: string }>();

const source = ref(props.expr);
const chosen = ref(props.env ?? "print");
const printing = ref(false);

const environment = computed<Environment>(() => {
  if (printing.value) return browserEnvironment({ print: true });
  return ENVIRONMENTS.find((e) => e.name === chosen.value) ?? ENVIRONMENTS[0]!;
});

const parsed = computed(() => parseNotatio(source.value));
const reduced = computed(() =>
  parsed.value.errors.length === 0 ? reduce(parsed.value.json, environment.value) : undefined,
);
const notatio = computed(() =>
  reduced.value === undefined ? "" : serializeNotatio(reduced.value),
);
const json = computed(() => (reduced.value === undefined ? "" : JSON.stringify(reduced.value)));

let media: MediaQueryList | undefined;
const onMedia = (e: MediaQueryListEvent): void => {
  printing.value = e.matches;
};
onMounted(() => {
  media = window.matchMedia("print");
  printing.value = mediaSignals((q) => window.matchMedia(q)).print === true;
  media.addEventListener("change", onMedia);
});
onUnmounted(() => media?.removeEventListener("change", onMedia));
</script>

<template>
  <ClientOnly>
    <div class="env">
      <div class="env-bar">
        <label v-for="e in ENVIRONMENTS" :key="e.name" class="env-pick">
          <input v-model="chosen" type="radio" :value="e.name" />
          {{ e.name }}
        </label>
        <span v-if="printing" class="env-note">printing</span>
      </div>
      <textarea v-model="source" class="env-source" rows="2" spellcheck="false" />
      <notatio-code language="notatio" :value="notatio" hide-lang />
      <div class="env-out">
        <Notatio v-if="json" :key="json" :json="json" />
      </div>
    </div>
  </ClientOnly>
</template>

<style scoped>
.env {
  display: grid;
  gap: 0.6rem;
}
.env-bar {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  font-size: 0.9rem;
}
.env-pick {
  display: inline-flex;
  gap: 0.3rem;
  align-items: center;
  cursor: pointer;
}
.env-note {
  color: var(--vp-c-text-3);
}
.env-source {
  width: 100%;
  font: 0.9rem/1.4 var(--vp-font-family-mono);
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  color: inherit;
  resize: vertical;
}
.env-out {
  padding: 0.6rem;
  border: 1px dashed var(--vp-c-divider);
  border-radius: 8px;
}
@media print {
  .env-bar,
  .env-source {
    display: none;
  }
}
</style>
