<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { resolveHead } from "../../data/reference.ts";

// A head's "Try it": the literals at its typed parameters in an example, as a Manipulate.
// Built from the manifest's parameter types (`IntegerPartitions(8)` over `(integer, any?, any?)`
// is an integer `n` starting at 8); a head with no typed literal in any example falls back to the
// derived explorer's sized call, and one with neither shows nothing. A parameter typed as a
// carrier (a permutation) gets an element picker: the example stands until a reader picks another
// element, which then takes that argument's place.
const props = defineProps<{
  name: string;
  /** The examples, as MathJSON, in page order; the first with a liftable literal is the panel's. */
  examples: readonly unknown[];
  /** The head's typed parameters (the manifest's `Parameter`s). */
  parameters: readonly { name?: string; type: string; variadic?: boolean }[];
  /** The carrier-typed parameter, and where its elements come from (`carrierSlotOf`, derived at build). */
  carrierSlot?: {
    index: number;
    picker: { carrier: string; template: string; size: { min: number; max: number; start: number }; glyph?: string };
  };
  /** The record's cap on the size parameter. */
  maxSize?: number;
  /** The derived explorer's sized call and stepper bounds: Try it's size control matches them, and stands in when no example lifts. */
  explorer?: { template?: string; size?: { name?: string; min: number; max: number; start: number } };
  /** The record's finite option values, by key: an example's `Key -> value` rule becomes a control. */
  optionValues?: Record<string, (string | number | boolean)[]>;
}>();

const panel = ref<{ params: string; value: string } | undefined>();
/** The example with the picked element, when nothing in it lifts to a control. */
const cell = ref<unknown>();
/** The element a reader picked; the example's own argument until then. */
const picked = ref<unknown>();
/** Bumped by a pick, so the panel is drawn anew. */
const version = ref(0);
const canPick = ref(false);

/** The panel is replaced only when its successor is ready, so the picker stays mounted (and keeps its place) through a pick. */
function show(next: { panel?: typeof panel.value; cell?: unknown; canPick?: boolean }): void {
  panel.value = next.panel;
  cell.value = next.cell;
  canPick.value = next.canPick ?? false;
}

async function build(): Promise<void> {
  // Nothing to lift when every position is `any` and no option lists its values; skip loading the front end for it.
  const typed = props.parameters.some((p) => p.type !== "any") || props.optionValues !== undefined;
  if (!typed && props.explorer?.template === undefined) return show({});
  // Browser only, and lazy: the front end brings the engine with it.
  const { argumentOf, tryItOf, tryItOfExplorer, withElement, withExplorerSize } = await import("@enumeratio/frontend");
  const signature = withExplorerSize(
    { head: props.name, parameters: props.parameters, maxSize: props.maxSize, options: props.optionValues },
    props.explorer,
  );
  const slot = props.carrierSlot;
  // With a carrier slot, the examples that call the head with an argument there to replace.
  const usable =
    slot === undefined
      ? props.examples
      : props.examples.filter((e) => argumentOf(e, props.name, slot.index) !== undefined);
  const pickable = slot !== undefined && usable.length > 0;
  const seeded = (expr: unknown): unknown =>
    slot === undefined || picked.value === undefined ? expr : withElement(expr, props.name, slot.index, picked.value);
  for (const expr of typed ? usable : []) {
    const found = tryItOf(seeded(expr) as Parameters<typeof tryItOf>[0], signature);
    if (found !== undefined) return show({ panel: found, canPick: pickable });
  }
  if (pickable) return show({ cell: seeded(usable[0]), canPick: true });
  show({ panel: tryItOfExplorer(props.explorer) });
}

function onPick(event: Event): void {
  picked.value = (event as CustomEvent<{ element: unknown }>).detail.element;
  version.value++;
  void build();
}

onMounted(build);
watch(
  () => props.name,
  () => {
    picked.value = undefined;
    show({});
    void build();
  },
);
</script>

<template>
  <section v-if="panel || cell" id="try-it" class="ref-try-it">
    <h2>Try it</h2>
    <ClientOnly>
      <notatio-element-picker
        v-if="canPick && carrierSlot"
        :key="`pick:${name}`"
        :template="carrierSlot.picker.template"
        :carrier="carrierSlot.picker.carrier"
        :glyph="carrierSlot.picker.glyph"
        :size="carrierSlot.picker.size.start"
        :size-min="carrierSlot.picker.size.min"
        :size-max="carrierSlot.picker.size.max"
        @notatio-element-pick="onPick"
      ></notatio-element-picker>
      <notatio-manipulate v-if="panel" :key="`${name}:${version}`" :params="panel.params">
        <dynamic-box :value="panel.value"></dynamic-box>
      </notatio-manipulate>
      <notatio-cell
        v-else-if="cell"
        :key="`${name}:${version}`"
        format="mathjson"
        :value="JSON.stringify(cell)"
        :resolveHead.prop="resolveHead"
      ></notatio-cell>
    </ClientOnly>
  </section>
</template>

<style scoped>
.ref-try-it {
  margin: 1.5rem 0;
}
</style>
