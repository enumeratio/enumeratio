<script setup lang="ts">
// The styling-hook lab: one panel of live surfaces — a hook swatch, db-emitted glyphs, the client-backed
// controls — under a switch for the standard styles (@enumeratio/components/styles.css). Its job is visual
// VALIDATION of the --enumeratio-* hooks: switch to `debug` and anything that keeps its color is a surface
// that missed a hook. Embedded as <ClientOnly><StyleLab /></ClientOnly> (the figures resolve from pglite).
import { ref } from 'vue'
import '@enumeratio/components/styles.css'

const styles = ['site theme', 'parchment', 'emerald', 'indigo', 'debug'] as const
const active = ref<(typeof styles)[number]>('site theme')

// All five hooks in one figure, injected through <svg-figure> — the same path a db-emitted glyph takes.
const swatch = `<svg viewBox="0 0 232 64" role="img" aria-label="styling-hook swatch">
  <rect x="1" y="1" width="230" height="62" rx="6" fill="var(--enumeratio-bg,#fff)" stroke="var(--enumeratio-border,currentColor)"/>
  <circle cx="32" cy="32" r="17" fill="var(--enumeratio-accent,#d97706)"/>
  <text x="62" y="28" font-size="13" fill="var(--enumeratio-text,currentColor)">text — body</text>
  <text x="62" y="48" font-size="12" fill="var(--enumeratio-muted,currentColor)">muted — secondary</text>
</svg>`
</script>

<template>
  <div class="lab">
    <div class="picker">
      <button v-for="s in styles" :key="s" :class="{ on: active === s }" @click="active = s">{{ s }}</button>
    </div>
    <div class="stage" :data-enumeratio-style="active === 'site theme' ? undefined : active">
      <div class="row">
        <svg-figure :svg="swatch"></svg-figure>
        <enumeratio-figure collection="dyck_paths" n="3" rank="2"></enumeratio-figure>
        <enumeratio-figure collection="integer_partitions" n="6" rank="3"></enumeratio-figure>
        <enumeratio-figure collection="binary_words" n="5" rank="9"></enumeratio-figure>
        <enumeratio-figure collection="permutations" n="4" rank="10"></enumeratio-figure>
        <enumeratio-figure collection="set_partitions" n="4" rank="6"></enumeratio-figure>
      </div>
      <div class="row">
        <span><enumeratio-notation collection="permutations" n="4" rank="10"></enumeratio-notation></span>
        <enumeratio-expression collection="rational_numbers" expr="1/2 + 1/3"></enumeratio-expression>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lab { border: 1px solid var(--vp-c-divider); border-radius: 8px; margin: 1rem 0; overflow: hidden; }
.picker { display: flex; gap: 0.35rem; padding: 0.6rem; border-bottom: 1px solid var(--vp-c-divider); flex-wrap: wrap; }
.picker button { border: 1px solid var(--vp-c-divider); border-radius: 5px; padding: 0.15rem 0.6rem;
  font-size: 0.82rem; background: var(--vp-c-bg-soft); color: var(--vp-c-text-1); cursor: pointer; }
.picker button.on { border-color: var(--e-color-brand); color: var(--e-color-brand-text); font-weight: 600; }
/* the stage itself drinks from the hooks, so the panel-level bg/text validate along with the figures */
.stage { padding: 1rem; background: var(--enumeratio-bg, var(--vp-c-bg)); color: var(--enumeratio-text, var(--vp-c-text-1)); }
.row { display: flex; gap: 1.5rem; align-items: flex-end; flex-wrap: wrap; }
.row + .row { margin-top: 1rem; align-items: center; }
</style>
