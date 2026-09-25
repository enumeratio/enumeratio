<script setup lang="ts">
// Dev-only review mode: a split screen over the review backlog (see
// web/.vitepress/review/backlog.ts and plugin.ts for the file format and the
// `/__review/*` API this talks to). Never built into the production site --
// this page is excluded from `vitepress build` via `srcExclude` in config.mts.
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

interface Bullet {
  key: string;
  value: string;
}
type ItemStatus = "open" | "reviewed" | "needs-work";
interface BacklogItem {
  id: string;
  title: string;
  status: ItemStatus;
  link?: string;
  pr?: string;
  check?: string;
  note?: string;
  bullets: Bullet[];
  feedback: string;
}

const STATUS_GLYPH: Record<ItemStatus, string> = { open: "○", reviewed: "✓", "needs-work": "!" };

const path = ref("");
const items = ref<BacklogItem[]>([]);
const loaded = ref(false);
const loadError = ref("");

const selectedId = ref<string | null>(null);
const statusFilter = ref<"all" | ItemStatus>("all");
const areaFilter = ref<string>("all");
const search = ref("");

const draft = ref("");
const saveState = ref<"idle" | "saving" | "saved" | "error">("idle");
let saveTimer: ReturnType<typeof setTimeout> | undefined;

const localPreview = ref(false);
const panelWidth = ref(34); // percent of viewport width
let resizing = false;

function prField(item: BacklogItem, index: number): string {
  return (
    (item.pr ?? "")
      .split("·")
      .map((s) => s.trim())
      .filter(Boolean)[index] ?? ""
  );
}
function prNumber(item: BacklogItem): string {
  return prField(item, 0).replace(/^#/, "");
}
function area(item: BacklogItem): string {
  return prField(item, 1);
}

const areas = computed(() => {
  const set = new Set<string>();
  for (const it of items.value) {
    const a = area(it);
    if (a) set.add(a);
  }
  return [...set].sort();
});

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  return items.value.filter((it) => {
    if (statusFilter.value !== "all" && it.status !== statusFilter.value) return false;
    if (areaFilter.value !== "all" && area(it) !== areaFilter.value) return false;
    if (
      q &&
      !(
        it.title.toLowerCase().includes(q) ||
        it.id.toLowerCase().includes(q) ||
        (it.check ?? "").toLowerCase().includes(q)
      )
    )
      return false;
    return true;
  });
});

const selected = computed(() => items.value.find((i) => i.id === selectedId.value) ?? null);

async function load(preserveSelection: boolean): Promise<void> {
  try {
    const res = await fetch("/__review/backlog");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { path: string; items: BacklogItem[] };
    path.value = data.path;
    items.value = data.items;
    loaded.value = true;
    loadError.value = "";
    const stillThere = preserveSelection && items.value.some((i) => i.id === selectedId.value);
    if (!stillThere) selectedId.value = items.value[0]?.id ?? null;
  } catch (e) {
    loaded.value = true;
    loadError.value = e instanceof Error ? e.message : String(e);
  }
}

function selectItem(id: string): void {
  void flushSave();
  selectedId.value = id;
}

// Reloading the draft (and dropping any pending save timer) whenever the
// selection changes -- but NOT on every backlog refresh, so an in-flight edit
// on the currently open item survives an HMR-triggered reload (see `load`,
// which only resets selection when the selected id disappeared).
watch(
  () => selected.value?.id,
  () => {
    draft.value = selected.value?.feedback ?? "";
    saveState.value = "idle";
  },
  { immediate: true },
);

function scheduleSave(): void {
  saveState.value = "saving";
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void flushSave(), 800);
}

async function flushSave(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = undefined;
  }
  const item = selected.value;
  if (!item || draft.value === item.feedback) {
    if (saveState.value === "saving") saveState.value = "idle";
    return;
  }
  saveState.value = "saving";
  try {
    const res = await fetch("/__review/item", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: item.id, feedback: draft.value }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { item: updated } = (await res.json()) as { item: BacklogItem };
    const idx = items.value.findIndex((i) => i.id === updated.id);
    if (idx !== -1) items.value[idx] = updated;
    saveState.value = "saved";
  } catch {
    saveState.value = "error";
  }
}

async function setStatus(status: ItemStatus): Promise<void> {
  const item = selected.value;
  if (!item) return;
  const previous = item.status;
  item.status = status; // optimistic
  try {
    const res = await fetch("/__review/item", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: item.id, status }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { item: updated } = (await res.json()) as { item: BacklogItem };
    const idx = items.value.findIndex((i) => i.id === updated.id);
    if (idx !== -1) items.value[idx] = updated;
  } catch {
    item.status = previous;
  }
}

function onKeydown(e: KeyboardEvent): void {
  const target = e.target as HTMLElement | null;
  const typing =
    !!target &&
    (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable);
  if (typing) return;
  if (e.key === "j" || e.key === "k") {
    const list = filtered.value;
    if (!list.length) return;
    const idx = list.findIndex((i) => i.id === selectedId.value);
    const next = e.key === "j" ? Math.min(list.length - 1, idx + 1) : Math.max(0, idx - 1);
    selectItem(list[Math.max(next, 0)]!.id);
    e.preventDefault();
  } else if (e.key === "1") void setStatus("open");
  else if (e.key === "2") void setStatus("reviewed");
  else if (e.key === "3") void setStatus("needs-work");
}

// Right panel: preview iframe, "Local" toggle, and hosts known to refuse framing
// (github.com sets X-Frame-Options; add here as others turn up).
const FRAME_BLOCKED_HOSTS = new Set(["github.com", "www.github.com"]);

function toLocalUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname === "enumeratio.dev" || u.hostname.endsWith(".enumeratio.pages.dev")) {
      return `${window.location.origin}${u.pathname}${u.search}${u.hash}`;
    }
  } catch {
    // not an absolute URL -- leave as-is
  }
  return url;
}

const frameUrl = computed(() => {
  const link = selected.value?.link;
  if (!link) return "";
  return localPreview.value ? toLocalUrl(link) : link;
});
const frameHostname = computed(() => {
  try {
    return new URL(frameUrl.value).hostname;
  } catch {
    return "";
  }
});
const frameBlocked = computed(() => FRAME_BLOCKED_HOSTS.has(frameHostname.value));

const prUrl = computed(() => {
  const item = selected.value;
  if (!item) return "";
  const n = prNumber(item);
  return n ? `https://github.com/enumeratio/enumeratio/pull/${n}` : "";
});

function startResize(e: MouseEvent): void {
  resizing = true;
  e.preventDefault();
}
function onMouseMove(e: MouseEvent): void {
  if (!resizing) return;
  panelWidth.value = Math.min(60, Math.max(20, (e.clientX / window.innerWidth) * 100));
}
function stopResize(): void {
  resizing = false;
}

let hotOff: (() => void) | undefined;
onMounted(() => {
  void load(false);
  window.addEventListener("keydown", onKeydown);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", stopResize);
  const hot = import.meta.hot;
  if (hot) {
    const handler = (): void => void load(true);
    hot.on("review:changed", handler);
    hotOff = () => hot.off("review:changed", handler);
  }
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  window.removeEventListener("mousemove", onMouseMove);
  window.removeEventListener("mouseup", stopResize);
  hotOff?.();
});
</script>

<template>
  <div class="review-mode">
    <div v-if="!loaded" class="review-state">Loading backlog…</div>
    <div v-else-if="loadError" class="review-state review-state-error">
      Failed to load backlog: {{ loadError }}
    </div>
    <div v-else-if="!items.length" class="review-state">
      No backlog file found at <code>{{ path }}</code
      >. Create it (or set <code>REVIEW_FILE</code>) to get started.
    </div>
    <div v-else class="review-split">
      <aside class="review-left" :style="{ width: panelWidth + '%' }">
        <header class="review-left-header">
          <div class="review-path" :title="path">{{ path }}</div>
          <div class="review-filters">
            <select v-model="statusFilter">
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="reviewed">Reviewed</option>
              <option value="needs-work">Needs work</option>
            </select>
            <select v-model="areaFilter">
              <option value="all">All areas</option>
              <option v-for="a in areas" :key="a" :value="a">{{ a }}</option>
            </select>
          </div>
          <input v-model="search" class="review-search" type="search" placeholder="Search…" />
        </header>
        <ul class="review-list">
          <li
            v-for="item in filtered"
            :key="item.id"
            :class="['review-list-item', { active: item.id === selectedId }]"
            @click="selectItem(item.id)"
          >
            <span class="review-glyph" :class="`status-${item.status}`">{{
              STATUS_GLYPH[item.status]
            }}</span>
            <span class="review-title">{{ item.title }}</span>
            <span class="review-meta">{{ prField(item, 0) }} · {{ area(item) }}</span>
          </li>
        </ul>
        <section v-if="selected" class="review-detail">
          <h3>{{ selected.title }}</h3>
          <p v-if="selected.check" class="review-field">
            <strong>Check</strong> {{ selected.check }}
          </p>
          <p v-if="selected.note" class="review-field"><strong>Note</strong> {{ selected.note }}</p>
          <p class="review-links">
            <a v-if="prUrl" :href="prUrl" target="_blank" rel="noreferrer"
              >PR {{ prField(selected, 0) }}</a
            >
            <a v-if="selected.link" :href="selected.link" target="_blank" rel="noreferrer"
              >Raw link</a
            >
          </p>
          <div class="review-status-buttons">
            <button :class="{ active: selected.status === 'open' }" @click="setStatus('open')">
              1 · Open
            </button>
            <button
              :class="{ active: selected.status === 'reviewed' }"
              @click="setStatus('reviewed')"
            >
              2 · Reviewed
            </button>
            <button
              :class="{ active: selected.status === 'needs-work' }"
              @click="setStatus('needs-work')"
            >
              3 · Needs work
            </button>
          </div>
          <label class="review-feedback-label" for="review-feedback">
            Feedback
            <span class="review-save-state" :class="saveState">{{
              saveState === "saving"
                ? "Saving…"
                : saveState === "saved"
                  ? "Saved"
                  : saveState === "error"
                    ? "Error saving"
                    : ""
            }}</span>
          </label>
          <textarea
            id="review-feedback"
            v-model="draft"
            class="review-feedback"
            @input="scheduleSave"
            @blur="flushSave"
          ></textarea>
        </section>
      </aside>
      <div class="review-splitter" @mousedown="startResize"></div>
      <main class="review-right">
        <div v-if="selected" class="review-right-header">
          <label class="review-local-toggle"
            ><input v-model="localPreview" type="checkbox" /> Local</label
          >
          <a
            v-if="selected.link"
            :href="selected.link"
            target="_blank"
            rel="noreferrer"
            class="review-open-tab"
            >Open in new tab ↗</a
          >
        </div>
        <div v-if="!selected" class="review-state">Select an item.</div>
        <div v-else-if="frameBlocked" class="review-state">
          <p>{{ frameHostname }} refuses to be framed.</p>
          <a :href="frameUrl" target="_blank" rel="noreferrer">Open in new tab ↗</a>
        </div>
        <iframe
          v-else-if="frameUrl"
          :key="frameUrl"
          class="review-frame"
          :src="frameUrl"
          title="Item preview"
        />
      </main>
    </div>
  </div>
</template>

<style scoped>
.review-mode {
  position: fixed;
  inset: 0;
  z-index: 1;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-family: var(--vp-font-family-base);
}
.review-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  height: 100%;
  color: var(--vp-c-text-2);
}
.review-state-error {
  color: var(--vp-c-danger-1);
}
.review-split {
  display: flex;
  height: 100%;
}
.review-left {
  display: flex;
  flex-direction: column;
  min-width: 260px;
  max-width: 70%;
  border-right: 1px solid var(--vp-c-divider);
  overflow: hidden;
}
.review-left-header {
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--vp-c-divider);
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.review-path {
  font-family: var(--vp-font-family-mono);
  font-size: 0.7rem;
  color: var(--vp-c-text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.review-filters {
  display: flex;
  gap: 0.4rem;
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
.review-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  flex: 1 1 40%;
  border-bottom: 1px solid var(--vp-c-divider);
}
.review-list-item {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  padding: 0.35rem 0.75rem;
  cursor: pointer;
  border-bottom: 1px solid var(--vp-c-divider);
  font-size: 0.82rem;
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
  font-size: 0.72rem;
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
  font-size: 0.95rem;
}
.review-field {
  margin: 0;
  font-size: 0.82rem;
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
  font-size: 0.75rem;
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
  font-size: 0.78rem;
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
  font-size: 0.85rem;
  line-height: 1.4;
}
.review-splitter {
  width: 5px;
  flex: none;
  cursor: col-resize;
  background: var(--vp-c-divider);
}
.review-splitter:hover {
  background: var(--vp-c-brand-1);
}
.review-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.review-right-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.4rem 0.75rem;
  border-bottom: 1px solid var(--vp-c-divider);
  font-size: 0.8rem;
}
.review-local-toggle {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--vp-c-text-2);
}
.review-frame {
  flex: 1;
  width: 100%;
  border: none;
}
</style>
