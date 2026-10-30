<script setup lang="ts">
import { onMounted, ref, watch } from "vue";

// A head's "Try it": the literals at its typed parameters in an example, as a Manipulate.
// Built from the manifest's parameter types (`IntegerPartitions(8)` over `(integer, any?, any?)`
// is an integer `n` starting at 8); a head with no typed literal in any example shows nothing.
const props = defineProps<{
  name: string;
  /** The examples, as MathJSON, in page order; the first with a liftable literal is the panel's. */
  examples: readonly unknown[];
  /** The head's typed parameters (the manifest's `Parameter`s). */
  parameters: readonly { name?: string; type: string; variadic?: boolean }[];
  /** The record's cap on the size parameter. */
  maxSize?: number;
  /** The record's finite option values, by key: an example's `Key -> value` rule becomes a control. */
  optionValues?: Record<string, (string | number | boolean)[]>;
}>();

const panel = ref<{ params: string; value: string } | undefined>();

async function build(): Promise<void> {
  panel.value = undefined;
  // Nothing to lift when every position is `any` and no option lists its values; skip loading the front end for it.
  if (!props.parameters.some((p) => p.type !== "any") && props.optionValues === undefined) return;
  // Browser only, and lazy: the front end brings the engine with it.
  const { tryItOf } = await import("@enumeratio/frontend");
  const signature = {
    head: props.name,
    parameters: props.parameters,
    maxSize: props.maxSize,
    options: props.optionValues,
  };
  for (const expr of props.examples) {
    const found = tryItOf(expr as Parameters<typeof tryItOf>[0], signature);
    if (found !== undefined) {
      panel.value = found;
      return;
    }
  }
}

onMounted(build);
watch(() => props.name, build);
</script>

<template>
  <section v-if="panel" id="try-it" class="ref-try-it">
    <h2>Try it</h2>
    <ClientOnly>
      <notatio-manipulate :key="name" :params="panel.params">
        <dynamic-box :value="panel.value"></dynamic-box>
      </notatio-manipulate>
    </ClientOnly>
  </section>
</template>

<style scoped>
.ref-try-it {
  margin: 1.5rem 0;
}
</style>
