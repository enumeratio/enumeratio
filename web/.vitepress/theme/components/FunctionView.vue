<script setup lang="ts">
import { type FunctionView, plotSectionOf } from "@enumeratio/frontend/function-view";
import { computed, onMounted, ref } from "vue";
import { plotMarkup } from "../../data/plot-markup.ts";

// A head's "Plot": the function drawn over one of its arguments, the others as sliders
// (the page's `functionView`, derived at build). Its sliders are its own: "Try it" lifts
// its controls from an example's literals, so the two panels move independently.
const props = defineProps<{ name: string; view?: FunctionView }>();

const section = computed(() => plotSectionOf(props.view));

// Each panel's drawing element, by its value; a panel that does not lower draws nothing.
const drawn = ref<Record<string, string | undefined>>({});
onMounted(async () => {
  const panels = section.value?.panels ?? [];
  const markup = await Promise.all(panels.map((p) => plotMarkup(p.value).catch(() => undefined)));
  drawn.value = Object.fromEntries(panels.map((p, i) => [p.value, markup[i]]));
});
</script>

<template>
  <section v-if="section" id="plot" class="ref-plot">
    <h2>Plot</h2>
    <p v-if="section.reason" class="ref-plot-reason">{{ section.reason }}</p>
    <figure v-for="panel in section.panels" :key="`${name}:${panel.label}`" class="ref-plot-panel">
      <figcaption v-if="section.panels.length > 1">{{ panel.label }}</figcaption>
      <ClientOnly>
        <div role="group" :aria-label="panel.aria">
          <template v-if="drawn[panel.value]">
            <notatio-manipulate v-if="panel.params" :params="panel.params">
              <div v-html="drawn[panel.value]"></div>
            </notatio-manipulate>
            <div v-else v-html="drawn[panel.value]"></div>
          </template>
        </div>
      </ClientOnly>
    </figure>
  </section>
</template>

<style scoped>
.ref-plot {
  margin: 1.5rem 0;
}
.ref-plot-panel {
  margin: 1rem 0;
}
.ref-plot-panel figcaption,
.ref-plot-reason {
  color: var(--vp-c-text-2);
  font-size: 0.875rem;
}
</style>
