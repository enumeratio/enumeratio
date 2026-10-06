<script setup lang="ts">
// The toggle for a panel's full-window mode (see useFullWindow). Sits in the panel's top-right
// corner, and stays in the window's while the panel is full-window.
defineProps<{ active: boolean; label: string }>();
defineEmits<{ toggle: [] }>();
</script>

<template>
  <button
    type="button"
    class="full-window-toggle"
    :class="{ active }"
    :aria-label="label"
    :aria-pressed="active"
    :title="label"
    @click="$emit('toggle')"
  >
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      aria-hidden="true"
    >
      <path v-if="active" d="M6 3v3H3M10 3v3h3M13 10h-3v3M3 10h3v3" />
      <path v-else d="M3 6V3h3M10 3h3v3M13 10v3h-3M6 13H3v-3" />
    </svg>
  </button>
</template>

<style scoped>
.full-window-toggle {
  position: absolute;
  top: 0.45rem;
  right: 0.6rem;
  z-index: 1;
  display: inline-flex;
  padding: 0.25rem;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--vp-c-text-3);
  cursor: pointer;
}
.full-window-toggle:hover {
  color: var(--vp-c-brand-1);
}
.full-window-toggle:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: -2px;
}
/* Above the covering live area, which sits above VitePress's nav and sidebar. */
.full-window-toggle.active {
  position: fixed;
  top: 0.6rem;
  right: 0.75rem;
  z-index: calc(var(--vp-z-index-sidebar) + 11);
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
}
</style>
