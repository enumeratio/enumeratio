<script setup lang="ts">
// One expression, reduced for an environment and rendered by the ordinary components:
// pick print and the controls become small multiples; pick a pipe and they pin. The
// page's own print is the same thing done for real -- `matchMedia("print")` flips the
// environment when the browser prints, so what comes out of the printer is the
// reduction, not a picture of a slider. A text-only environment (tty, pipe) is shown
// in a terminal, printed the way the CLI prints it and, for a tty, driven from its keys.
// `#<card>=<env>` links to a card opened on an environment; picking one writes it.
import {
  browserEnvironment,
  can,
  ENVIRONMENTS,
  type Environment,
  evaluateReadouts,
  loadEngine,
  mediaSignals,
  reduce,
} from "@enumeratio/notatio";
import { parseNotatio, serializeNotatio } from "@enumeratio/formats/notatio";
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from "vue";

const props = defineProps<{ expr: string; env?: string }>();

const source = ref(props.expr);
const chosen = ref(props.env ?? "print");
const printing = ref(false);

const environment = computed<Environment>(() => {
  if (printing.value) return browserEnvironment({ print: true });
  return ENVIRONMENTS.find((e) => e.name === chosen.value) ?? ENVIRONMENTS[0]!;
});

const engine = shallowRef<Awaited<ReturnType<typeof loadEngine>>>();
const parsed = computed(() => parseNotatio(source.value));
// With no engine at view time a readout is the value it had when the page was made.
const reduced = computed(() => {
  if (parsed.value.errors.length > 0) return undefined;
  const out = reduce(parsed.value.json, environment.value);
  const ce = engine.value;
  return ce === undefined || can.drive(environment.value)
    ? out
    : evaluateReadouts(out, (e) => ce.box(e).evaluate().json);
});
const notatio = computed(() => (reduced.value === undefined ? "" : serializeNotatio(reduced.value)));
const json = computed(() => (reduced.value === undefined ? "" : JSON.stringify(reduced.value)));
const textOnly = computed(() => environment.value.surface.every((s) => s === "text"));

const card = ref<HTMLElement>();
const story = (): HTMLElement | null | undefined => card.value?.closest<HTMLElement>(".story[id]");

/** Open on the environment the hash names for this card, and bring the card into view. */
const followHash = (): void => {
  const id = story()?.id;
  const [target, env] = decodeURIComponent(location.hash.slice(1)).split("=");
  if (id === undefined || target !== id || !ENVIRONMENTS.some((e) => e.name === env)) return;
  chosen.value = env!;
  story()?.scrollIntoView();
};
const pick = (): void => {
  const id = story()?.id;
  if (id) history.replaceState(history.state, "", `#${id}=${chosen.value}`);
};
// The card mounts inside ClientOnly, after this component does.
watch(card, (el) => el && followHash());

let media: MediaQueryList | undefined;
const onMedia = (e: MediaQueryListEvent): void => {
  printing.value = e.matches;
};
onMounted(() => {
  void loadEngine().then((ce) => (engine.value = ce));
  media = window.matchMedia("print");
  printing.value = mediaSignals((q) => window.matchMedia(q)).print === true;
  media.addEventListener("change", onMedia);
  window.addEventListener("hashchange", followHash);
});
onUnmounted(() => {
  media?.removeEventListener("change", onMedia);
  window.removeEventListener("hashchange", followHash);
});
</script>

<template>
  <ClientOnly>
    <div ref="card" class="env">
      <div class="env-bar">
        <label v-for="e in ENVIRONMENTS" :key="e.name" class="env-pick">
          <input v-model="chosen" type="radio" :value="e.name" @change="pick" />
          {{ e.name }}
        </label>
        <span v-if="printing" class="env-note">printing</span>
      </div>
      <textarea v-model="source" class="env-source" rows="2" spellcheck="false" />
      <notatio-code language="notatio" :value="notatio" hide-lang />
      <div class="env-out" :env="environment.name">
        <notatio-terminal v-if="textOnly" mode="show" :env="environment.name" :value="source" />
        <Notatio v-else-if="json" :key="json" :json="json" />
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
