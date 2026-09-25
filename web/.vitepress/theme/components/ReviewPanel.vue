<script setup lang="ts">
// Dev-only review sidebar, mounted on every docs page through the theme Layout (see
// web/.vitepress/theme/Layout.vue) -- never built into production (gated by
// `import.meta.env.DEV` at the Layout call site, matching the old ReviewMode.vue's
// pattern). Content -- list, filters, detail, status buttons, autosaving feedback --
// is the same backlog UI ReviewMode.vue had; what changed is the right-hand side:
// selecting an item now navigates the SITE ITSELF (VitePress's router) instead of
// framing it in an iframe. See web/.vitepress/review/link.ts for the link rewrite.
import { useRoute, useRouter } from "vitepress";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { BacklogItem, ItemStatus } from "../../review/backlog.ts";
import { resolveReviewLink, splitHash } from "../../review/link.ts";
import { reviewModeOn, toggleReviewMode } from "../review/mode.ts";
import { area, prField, prNumber, useReviewStore } from "../review/store.ts";

const STATUS_GLYPH: Record<ItemStatus, string> = { open: "○", reviewed: "✓", "needs-work": "!" };

const store = useReviewStore();
const route = useRoute();
const router = useRouter();

const panelWidth = ref(360); // px
let resizing = false;

function isReviewLandingPath(p: string): boolean {
  return p === "/review" || p === "/review.html" || p === "/review/";
}

/** Navigate the site to an item's link (local) or leave it for the "Open in new
 * tab" affordance to handle (external) -- see resolveReviewLink. */
function goToItem(item: BacklogItem): void {
  if (!item.link) return;
  const resolved = resolveReviewLink(item.link);
  if (resolved.kind === "local") void router.go(resolved.path);
}

const linkFor = (item: BacklogItem) => resolveReviewLink(item.link ?? "");

function choose(id: string): void {
  store.selectItem(id);
  const item = store.items.value.find((i) => i.id === id);
  if (item) goToItem(item);
}

// `/review` itself: open the panel and land on the persisted selection, or the
// first open item, or the first item at all -- once the backlog has loaded.
let landed = false;
watch(
  () => [route.path, store.loaded.value, store.landingItem.value] as const,
  ([p, loadedVal, item]) => {
    if (!isReviewLandingPath(p)) {
      landed = false;
      return;
    }
    store.isOpen.value = true;
    if (landed || !loadedVal || !item) return;
    landed = true;
    store.selectedId.value = item.id;
    goToItem(item);
  },
  { immediate: true },
);

function onKeydown(e: KeyboardEvent): void {
  if (!store.isOpen.value) return;
  const target = e.target as HTMLElement | null;
  const typing =
    !!target &&
    (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable);
  if (typing) return;
  if (e.key === "j" || e.key === "k") {
    const list = store.filtered.value;
    if (!list.length) return;
    const idx = list.findIndex((i) => i.id === store.selectedId.value);
    const next = e.key === "j" ? Math.min(list.length - 1, idx + 1) : Math.max(0, idx - 1);
    choose(list[Math.max(next, 0)]!.id);
    e.preventDefault();
  } else if (e.key === "1") void store.setStatus("open");
  else if (e.key === "2") void store.setStatus("reviewed");
  else if (e.key === "3") void store.setStatus("needs-work");
}

function startResize(e: MouseEvent): void {
  resizing = true;
  e.preventDefault();
}
function onMouseMove(e: MouseEvent): void {
  if (!resizing) return;
  panelWidth.value = Math.min(720, Math.max(280, window.innerWidth - e.clientX));
}
function stopResize(): void {
  resizing = false;
}

// --- Persistent highlight (requirement 1) ---------------------------------------
// While the selected item's link targets a fragment on the CURRENT page, keep that
// element outlined for as long as it stays selected -- not just a brief flash (see
// ReferencePage.vue's `highlight()`, which is unrelated and still just flashes on
// hash navigation). Cleared whenever the selection changes, the panel closes, or the
// route changes away from the target's page.
const HIGHLIGHT_CLASS = "review-highlight-target";
let highlightedEl: HTMLElement | null = null;
let highlightRaf = 0;

function clearHighlight(): void {
  if (highlightRaf) cancelAnimationFrame(highlightRaf);
  highlightRaf = 0;
  highlightedEl?.classList.remove(HIGHLIGHT_CLASS);
  highlightedEl = null;
}

// The target element may not exist yet (e.g. a ClientOnly example section still
// mounting) -- poll a few animation frames, then give up silently: a stale or
// no-longer-valid anchor (a later `#example-N` → `#example/<id>` migration, say)
// just means no highlight, never an error.
function tryHighlight(id: string, attemptsLeft: number): void {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add(HIGHLIGHT_CLASS);
    highlightedEl = el;
    return;
  }
  if (attemptsLeft <= 0) return;
  highlightRaf = requestAnimationFrame(() => tryHighlight(id, attemptsLeft - 1));
}

function updateHighlight(): void {
  clearHighlight();
  if (!store.isOpen.value) return;
  const item = store.selected.value;
  if (!item?.link) return;
  const resolved = resolveReviewLink(item.link);
  if (resolved.kind !== "local") return;
  const { path, id } = splitHash(resolved.path);
  if (!id || path !== route.path) return;
  tryHighlight(id, 20); // ~20 frames, generous enough for ClientOnly content to mount
}

watch(
  // `.link` too, not just `.id` -- a live reload from the file watcher (Dean editing
  // REVIEW.md, or another tab syncing localStorage) can change the already-selected
  // item's link in place without changing which item is selected.
  () =>
    [store.isOpen.value, store.selected.value?.id, store.selected.value?.link, route.path] as const,
  () => updateHighlight(),
  { immediate: true },
);

// --- Modifier-click to review (requirement 2) -------------------------------------
// alt + (cmd on macOS / ctrl elsewhere) on any element with an id -- the
// ReferencePage anchors (#example-N, #signatures, #details, #enumeration,
// #implementation) plus any heading, which VitePress already gives an id. A plain
// cmd/ctrl-click is deliberately left alone (adding `alt` means we never have to
// special-case `<a href>` to preserve the browser's own open-in-new-tab gesture).
function isReviewModifierClick(e: MouseEvent): boolean {
  return e.altKey && (e.metaKey || e.ctrlKey);
}

function currentPageLabel(): string {
  return document.title.split(" | ")[0]?.trim() || route.path;
}

async function onDocumentClick(e: MouseEvent): Promise<void> {
  if (!reviewModeOn.value || !isReviewModifierClick(e)) return;
  const target = e.target as HTMLElement | null;
  const anchored = target?.closest("[id]") as HTMLElement | null;
  if (!anchored?.id) return;
  e.preventDefault();
  e.stopPropagation();
  store.isOpen.value = true;
  await store.selectOrCreateAdhoc(currentPageLabel(), route.path, anchored.id);
}

onMounted(() => {
  store.init();
  if (new URLSearchParams(location.search).has("review")) store.isOpen.value = true;
  window.addEventListener("keydown", onKeydown);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", stopResize);
  document.addEventListener("click", onDocumentClick, true);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  window.removeEventListener("mousemove", onMouseMove);
  window.removeEventListener("mouseup", stopResize);
  document.removeEventListener("click", onDocumentClick, true);
  clearHighlight();
});
</script>

<template>
  <button
    class="review-toggle"
    :class="{ 'is-open': store.isOpen.value }"
    :title="store.isOpen.value ? 'Close review panel' : 'Open review panel'"
    @click="store.isOpen.value = !store.isOpen.value"
  >
    ☰ Review
  </button>

  <aside v-if="store.isOpen.value" class="review-panel" :style="{ width: panelWidth + 'px' }">
    <div class="review-splitter" @mousedown="startResize"></div>
    <div v-if="!store.loaded.value" class="review-state">Loading backlog…</div>
    <div v-else-if="store.loadError.value" class="review-state review-state-error">
      Failed to load backlog: {{ store.loadError.value }}
    </div>
    <div v-else-if="!store.items.value.length" class="review-state">
      No backlog file found at <code>{{ store.path.value }}</code
      >.
    </div>
    <template v-else>
      <header class="review-header">
        <div class="review-path" :title="store.path.value">{{ store.path.value }}</div>
        <button class="review-close" title="Close" @click="store.isOpen.value = false">×</button>
      </header>
      <div class="review-toolbar">
        <button class="review-copy" @click="store.copyFeedback">
          {{
            store.copyState.value === "copied"
              ? "Copied ✓"
              : store.copyState.value === "error"
                ? "Copy failed"
                : "Copy feedback"
          }}
        </button>
        <button class="review-mode-toggle" title="Turn review mode off" @click="toggleReviewMode()">
          Review mode: on
        </button>
      </div>
      <details class="review-help">
        <summary>Help</summary>
        <p>
          <code>?review</code> in the URL turns review mode on for this browser (persists via
          localStorage); <code>?review=off</code> turns it off. It's on by default under
          <code>vitepress dev</code>.
        </p>
        <p>
          Alt + Cmd-click (macOS) or Alt + Ctrl-click (elsewhere) on any anchored element -- an
          example, a heading, an implementation section -- opens this panel on its review item,
          creating one if it doesn't exist yet.
        </p>
      </details>
      <div class="review-filters">
        <select v-model="store.statusFilter.value">
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="reviewed">Reviewed</option>
          <option value="needs-work">Needs work</option>
        </select>
        <select v-model="store.areaFilter.value">
          <option value="all">All areas</option>
          <option v-for="a in store.areas.value" :key="a" :value="a">{{ a }}</option>
        </select>
      </div>
      <input
        v-model="store.search.value"
        class="review-search"
        type="search"
        placeholder="Search…"
      />
      <ul class="review-list">
        <li
          v-for="item in store.filtered.value"
          :key="item.id"
          :class="['review-list-item', { active: item.id === store.selectedId.value }]"
          @click="choose(item.id)"
        >
          <span class="review-glyph" :class="`status-${item.status}`">{{
            STATUS_GLYPH[item.status]
          }}</span>
          <span class="review-title">{{ item.title }}</span>
          <span class="review-meta">{{ prField(item, 0) }} · {{ area(item) }}</span>
        </li>
      </ul>
      <section v-if="store.selected.value" class="review-detail">
        <h3>{{ store.selected.value.title }}</h3>
        <p v-if="store.selected.value.check" class="review-field">
          <strong>Check</strong> {{ store.selected.value.check }}
        </p>
        <p v-if="store.selected.value.note" class="review-field">
          <strong>Note</strong> {{ store.selected.value.note }}
        </p>
        <p class="review-links">
          <a
            v-if="prNumber(store.selected.value)"
            :href="`https://github.com/enumeratio/enumeratio/pull/${prNumber(store.selected.value)}`"
            target="_blank"
            rel="noreferrer"
            >PR {{ prField(store.selected.value, 0) }}</a
          >
          <template v-if="store.selected.value.link">
            <a
              v-if="linkFor(store.selected.value).kind === 'external'"
              :href="store.selected.value.link"
              target="_blank"
              rel="noreferrer"
              >Open in new tab ↗</a
            >
            <a v-else href="#" @click.prevent="goToItem(store.selected.value)">Go to page</a>
          </template>
        </p>
        <div class="review-status-buttons">
          <button
            :class="{ active: store.selected.value.status === 'open' }"
            @click="store.setStatus('open')"
          >
            1 · Open
          </button>
          <button
            :class="{ active: store.selected.value.status === 'reviewed' }"
            @click="store.setStatus('reviewed')"
          >
            2 · Reviewed
          </button>
          <button
            :class="{ active: store.selected.value.status === 'needs-work' }"
            @click="store.setStatus('needs-work')"
          >
            3 · Needs work
          </button>
        </div>
        <label class="review-feedback-label" for="review-feedback">
          Feedback
          <span class="review-save-state" :class="store.saveState.value">{{
            store.saveState.value === "saving"
              ? "Saving…"
              : store.saveState.value === "saved"
                ? "Saved"
                : store.saveState.value === "error"
                  ? "Error saving"
                  : ""
          }}</span>
        </label>
        <textarea
          id="review-feedback"
          v-model="store.draft.value"
          class="review-feedback"
          @input="store.scheduleSave"
          @blur="store.flushSave"
        ></textarea>
      </section>
    </template>
  </aside>
</template>

<style scoped>
.review-toggle {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  z-index: 1001;
  background: var(--vp-c-brand-1);
  color: var(--vp-c-white, #fff);
  border: none;
  border-radius: 999px;
  padding: 0.5rem 0.9rem;
  font-size: 0.8rem;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}
.review-toggle.is-open {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  border: 1px solid var(--vp-c-divider);
}
.review-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  min-width: 280px;
  max-width: 720px;
  display: flex;
  flex-direction: column;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  border-left: 1px solid var(--vp-c-divider);
  box-shadow: -2px 0 12px rgba(0, 0, 0, 0.15);
  font-family: var(--vp-font-family-base);
}
.review-splitter {
  position: absolute;
  left: -3px;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
}
.review-splitter:hover {
  background: var(--vp-c-brand-1);
}
.review-state {
  padding: 1rem;
  color: var(--vp-c-text-2);
  font-size: 0.85rem;
}
.review-state-error {
  color: var(--vp-c-danger-1);
}
.review-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 0.75rem 0.2rem;
}
.review-path {
  font-family: var(--vp-font-family-mono);
  font-size: 0.68rem;
  color: var(--vp-c-text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.review-close {
  background: none;
  border: none;
  color: var(--vp-c-text-2);
  font-size: 1.1rem;
  cursor: pointer;
  line-height: 1;
}
.review-filters {
  display: flex;
  gap: 0.4rem;
  padding: 0.2rem 0.75rem;
}
.review-filters select,
.review-search {
  flex: 1;
  min-width: 0;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-1);
  border-radius: 4px;
  padding: 0.25rem 0.4rem;
  font-size: 0.8rem;
}
.review-search {
  margin: 0.3rem 0.75rem;
}
.review-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  flex: 1 1 40%;
  border-top: 1px solid var(--vp-c-divider);
  border-bottom: 1px solid var(--vp-c-divider);
}
.review-list-item {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  padding: 0.35rem 0.75rem;
  cursor: pointer;
  border-bottom: 1px solid var(--vp-c-divider);
  font-size: 0.8rem;
}
.review-list-item:hover {
  background: var(--vp-c-bg-soft);
}
.review-list-item.active {
  background: var(--vp-c-brand-soft);
}
.review-glyph {
  font-family: var(--vp-font-family-mono);
  width: 1.1em;
  flex: none;
  text-align: center;
}
.review-glyph.status-open {
  color: var(--vp-c-text-3);
}
.review-glyph.status-reviewed {
  color: var(--vp-c-green-1);
}
.review-glyph.status-needs-work {
  color: var(--vp-c-warning-1);
}
.review-title {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.review-meta {
  flex: none;
  color: var(--vp-c-text-3);
  font-size: 0.68rem;
  font-family: var(--vp-font-family-mono);
}
.review-detail {
  flex: 1 1 60%;
  overflow-y: auto;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.review-detail h3 {
  margin: 0;
  font-size: 0.9rem;
}
.review-field {
  margin: 0;
  font-size: 0.8rem;
  color: var(--vp-c-text-2);
}
.review-field strong {
  color: var(--vp-c-text-1);
  margin-right: 0.3em;
}
.review-links {
  display: flex;
  gap: 0.75rem;
  margin: 0;
  font-size: 0.8rem;
}
.review-status-buttons {
  display: flex;
  gap: 0.4rem;
}
.review-status-buttons button {
  flex: 1;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  border-radius: 4px;
  padding: 0.3rem 0.4rem;
  font-size: 0.72rem;
  cursor: pointer;
}
.review-status-buttons button.active {
  background: var(--vp-c-brand-soft);
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.review-feedback-label {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 0.75rem;
  color: var(--vp-c-text-2);
}
.review-save-state.saving {
  color: var(--vp-c-text-3);
}
.review-save-state.saved {
  color: var(--vp-c-green-1);
}
.review-save-state.error {
  color: var(--vp-c-danger-1);
}
.review-feedback {
  flex: 1;
  min-height: 8rem;
  resize: vertical;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-1);
  border-radius: 4px;
  padding: 0.5rem;
  font-family: var(--vp-font-family-base);
  font-size: 0.82rem;
  line-height: 1.4;
}
.review-toolbar {
  display: flex;
  gap: 0.4rem;
  padding: 0.3rem 0.75rem 0;
}
.review-toolbar button {
  flex: 1;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  border-radius: 4px;
  padding: 0.25rem 0.4rem;
  font-size: 0.72rem;
  cursor: pointer;
}
.review-help {
  margin: 0.3rem 0.75rem 0;
  font-size: 0.75rem;
  color: var(--vp-c-text-2);
}
.review-help summary {
  cursor: pointer;
  color: var(--vp-c-text-3);
}
.review-help p {
  margin: 0.4rem 0 0;
  line-height: 1.4;
}
.review-help code {
  font-size: 0.9em;
}
</style>

<style>
/* Persistent highlight (requirement 1) -- global, not scoped: the target lives
   outside this component's DOM (a review item's link points at an id anywhere on
   the current page). Subtle and theme-aware so it reads fine in light and dark. */
.review-highlight-target {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 3px;
  border-radius: 6px;
  background-color: var(--vp-c-brand-soft);
  transition:
    outline-color 0.15s,
    background-color 0.15s;
}
</style>
