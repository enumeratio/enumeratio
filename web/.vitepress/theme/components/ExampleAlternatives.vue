<script setup lang="ts">
import { computed, ref } from "vue";

// Another system's run of one example: the source it was given and what came back. Same
// vocabulary as the oracle sidecars (`OtherSystemRun`, packages/entry/src/types.ts).
export interface Alternative {
  readonly input: string;
  readonly output: string;
  readonly verdict: "agree" | "disagree" | "inconclusive" | "error";
}

const props = defineProps<{
  alternatives: Record<string, Alternative>;
  notes?: Record<string, string>;
}>();

const LABEL: Record<string, string> = { wolfram: "Wolfram", sage: "Sage", sympy: "SymPy" };
const MARK: Record<Alternative["verdict"], string> = {
  agree: "",
  disagree: "≠",
  inconclusive: "∅",
  error: "!",
};
const TITLE: Record<Alternative["verdict"], string> = {
  agree: "agrees",
  disagree: "gives a different answer",
  inconclusive: "leaves it unevaluated",
  error: "raises an error",
};

const systems = computed(() => Object.keys(props.alternatives));
const active = ref<string | undefined>();
const toggle = (system: string): void => {
  active.value = active.value === system ? undefined : system;
};
const shown = computed(() =>
  active.value === undefined ? undefined : props.alternatives[active.value],
);
</script>

<template>
  <div class="alt">
    <div class="alt-tabs" role="tablist">
      <button
        v-for="system in systems"
        :key="system"
        role="tab"
        class="alt-tab"
        :class="[`is-${alternatives[system]!.verdict}`, { 'is-active': active === system }]"
        :aria-selected="active === system"
        :title="`${LABEL[system] ?? system} ${TITLE[alternatives[system]!.verdict]}`"
        @click="toggle(system)"
      >
        {{ LABEL[system] ?? system }}
        <span v-if="MARK[alternatives[system]!.verdict]" class="alt-mark">{{
          MARK[alternatives[system]!.verdict]
        }}</span>
      </button>
    </div>
    <div v-if="shown" class="alt-panel" role="tabpanel">
      <div class="alt-row">
        <span class="alt-label">In</span><code>{{ shown.input }}</code>
      </div>
      <div class="alt-row">
        <span class="alt-label">Out</span><code>{{ shown.output }}</code>
      </div>
      <p v-if="active && notes?.[active]" class="alt-note">{{ notes[active] }}</p>
    </div>
  </div>
</template>

<style scoped>
/* The tabs float right on the Out row; an opened panel wraps below it, full width. */
.alt {
  display: contents;
}
.alt-tabs {
  display: flex;
  gap: 0.25rem;
  margin-left: auto;
}
.alt-tab {
  padding: 0 0.45rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  color: var(--vp-c-text-2);
  font-size: 0.72rem;
  line-height: 1.5;
  cursor: pointer;
}
.alt-tab:hover,
.alt-tab.is-active {
  border-color: var(--vp-c-text-3);
  color: var(--vp-c-text-1);
}
.alt-mark {
  margin-left: 0.15rem;
}
.alt-tab.is-disagree .alt-mark,
.alt-tab.is-inconclusive .alt-mark,
.alt-tab.is-error .alt-mark {
  color: #b7791f;
}
.alt-panel {
  flex-basis: 100%;
  margin-top: 0.3rem;
  padding: 0.35rem 0.6rem;
  border-left: 2px solid var(--vp-c-divider);
  font-size: 0.8rem;
}
.alt-row {
  display: flex;
  gap: 0.6rem;
  align-items: baseline;
}
.alt-label {
  min-width: 1.6rem;
  color: var(--vp-c-text-3);
  font-size: 0.72rem;
}
.alt-note {
  margin: 0.25rem 0 0;
  color: var(--vp-c-text-2);
}
</style>
