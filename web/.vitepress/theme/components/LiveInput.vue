<script setup lang="ts">
// A live, editable input wired to an evaluated output: type math on the left,
// see the boxed/evaluated result update on the right. Demonstrates the
// non-read-only <notatio-in> driving <notatio-out> via notatio-change.
import { formOfHead, splitHead } from "@enumeratio/components";
import { ref } from "vue";

const props = defineProps<{ value?: string }>();
const latex = ref(props.value ?? "");
const form = ref("standard");

// A *Form head is a request for a representation, so it is read off and honoured
// rather than handed to the engine; `N` is the engine's own head and stays put.
function onChange(e: Event) {
  const detail = (e as CustomEvent<{ latex: string }>).detail;
  if (!detail) return;
  const { head, body } = splitHead(detail.latex);
  const wanted = formOfHead(head);
  form.value = wanted ?? "standard";
  latex.value = wanted ? body : detail.latex;
}
</script>

<template>
  <ClientOnly>
    <div class="live">
      <notatio-in :value="props.value ?? ''" @notatio-change="onChange" />
      <div class="live-arrow">→</div>
      <div class="live-out">
        <notatio-out :value="latex" format="latex" :form="form" evaluate />
      </div>
    </div>
  </ClientOnly>
</template>

<style scoped>
.live {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  flex-wrap: wrap;
}
.live > * {
  flex: 1 1 12rem;
}
.live-arrow {
  flex: 0 0 auto;
  color: var(--vp-c-text-3);
}
.live-out {
  min-height: 2rem;
  padding: 0.4rem 0.6rem;
  border: 1px dashed var(--vp-c-divider);
  border-radius: 8px;
}
</style>
