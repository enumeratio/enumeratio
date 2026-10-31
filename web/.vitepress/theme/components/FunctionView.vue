<script setup lang="ts">
import { type FunctionView, plotSectionOf } from "@enumeratio/frontend/function-view";
import { computed } from "vue";

// A head's "Plot": the function drawn over one of its arguments, the others as sliders
// (the page's `functionView`, derived at build). Its sliders are its own: "Try it" lifts
// its controls from an example's literals, so the two panels move independently.
const props = defineProps<{ name: string; view?: FunctionView }>();

const section = computed(() => plotSectionOf(props.view));
</script>

<template>
  <section v-if="section" id="plot" class="ref-plot">
    <h2>Plot</h2>
    <p v-if="section.reason" class="ref-plot-reason">{{ section.reason }}</p>
    <figure v-for="panel in section.panels" :key="`${name}:${panel.label}`" class="ref-plot-panel">
      <figcaption v-if="section.panels.length > 1">{{ panel.label }}</figcaption>
      <ClientOnly>
        <div role="group" :aria-label="panel.aria">
          <notatio-manipulate v-if="panel.params" :params="panel.params">
            <dynamic-box :value="panel.value"></dynamic-box>
          </notatio-manipulate>
          <dynamic-box v-else :value="panel.value"></dynamic-box>
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
