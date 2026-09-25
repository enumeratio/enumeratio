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
import { resolveReviewLink } from "../../review/link.ts";
import { reviewModeOn, toggleReviewMode } from "../review/mode.ts";
import { area, prField, prNumber, useReviewStore } from "../review/store.ts";

// Reviewed is a checkbox; needs work is a flag, and setting either clears the other.
const toggleReviewed = (item: BacklogItem): Promise<void> =>
  store.setStatus(item.status === "reviewed" ? "open" : "reviewed", item);
const toggleNeedsWork = (item: BacklogItem): Promise<void> =>
  store.setStatus(item.status === "needs-work" ? "open" : "needs-work", item);

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
  const typing = !!target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable);
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

// The item's target stays outlined through the URL's fragment (../fragment.ts): choosing
// an item navigates to its link, anchor included.

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
          Review mode exists under <code>vitepress dev</code> (or a build made with <code>VITE_REVIEW=1</code>), where
          it's on by default. <code>?review=off</code> turns it off for this browser, and <code>?review</code> back on.
          The panel starts collapsed.
        </p>
        <p>
          Alt + Cmd-click (macOS) or Alt + Ctrl-click (elsewhere) on any anchored element -- an example, a heading, an
          implementation section -- opens this panel on its review item, creating one if it doesn't exist yet.
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
      <input v-model="store.search.value" class="review-search" type="search" placeholder="Search…" />
      <ul class="review-list">
        <li
          v-for="item in store.filtered.value"
          :key="item.id"
          :class="['review-list-item', { active: item.id === store.selectedId.value }]"
          @click="choose(item.id)"
        >
          <input
            type="checkbox"
            class="review-check"
            :checked="item.status === 'reviewed'"
            :aria-label="`Reviewed: ${item.title}`"
            @click.stop="toggleReviewed(item)"
          />
          <button
            class="review-flag"
            :class="{ on: item.status === 'needs-work' }"
            :aria-pressed="item.status === 'needs-work'"
            :title="item.status === 'needs-work' ? 'Needs work (click to clear)' : 'Flag as needs work'"
            @click.stop="toggleNeedsWork(item)"
          >
            ⚑
          </button>
          <span class="review-title">{{ item.title }}</span>
          <span class="review-meta">{{ prField(item, 0) }} · {{ area(item) }}</span>
        </li>
      </ul>
      <section v-if="store.selected.value" class="review-detail">
        <h3 class="review-detail-title">
          <input
            type="checkbox"
            class="review-check"
            :checked="store.selected.value.status === 'reviewed'"
            aria-label="Reviewed"
            title="Reviewed (2)"
            @click="toggleReviewed(store.selected.value)"
          />
          <button
            class="review-flag"
            :class="{ on: store.selected.value.status === 'needs-work' }"
            :aria-pressed="store.selected.value.status === 'needs-work'"
            title="Needs work (3)"
            @click="toggleNeedsWork(store.selected.value)"
          >
            ⚑
          </button>
          <span>{{ store.selected.value.title }}</span>
        </h3>
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
.review-check {
  flex: none;
  margin: 0;
  cursor: pointer;
  accent-color: var(--vp-c-green-1);
}
.review-flag {
  flex: none;
  border: none;
  background: none;
  padding: 0 0.1rem;
  line-height: 1;
  cursor: pointer;
  color: var(--vp-c-text-3);
  opacity: 0.35;
}
.review-flag:hover,
.review-flag.on {
  opacity: 1;
}
.review-flag.on {
  color: var(--vp-c-warning-1);
}
.review-detail-title {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
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

<style></style>
