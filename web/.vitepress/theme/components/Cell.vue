<script setup lang="ts">
// `<Cell>` -- the Vue face of `<notatio-cell>`, named for the symbol rather than the tag:
// the one worked example behind design/components-and-symbols.md. Its props are the
// element's attributes, typed, so a markdown author composes Vue and gets completion and
// a compile-time check on the spelling; the element underneath is unchanged. Anything
// not declared here falls through as an attribute.
import type { InForm } from "@enumeratio/elements";

withDefaults(
  defineProps<{
    /** The input, as notatio (or as `inForm` says). */
    value: string;
    /** `notatio` (default), `latex` or `wolfram`. */
    inForm?: InForm;
    /** The Out representation: `standard`, `traditional`, `input`, `tex`, ... */
    outForm?: string;
    /** Box rather than evaluate, so a source form shows the expression itself. */
    box?: boolean;
  }>(),
  { inForm: "notatio", outForm: "standard", box: false },
);
</script>

<template>
  <ClientOnly>
    <notatio-cell :value="value" :in-form="inForm" :out-form="outForm" :box="box" />
  </ClientOnly>
</template>
