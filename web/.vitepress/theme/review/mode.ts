// Review mode's on/off switch. ON by default under `vitepress dev`, opt-in
// everywhere else (prod, CF previews) -- see AGENTS.md. `?review` in the URL sets a
// persistent localStorage flag; `?review=off` clears it. This module is small and
// import.meta.env.DEV/localStorage-only, so it's fine to keep in the main bundle --
// it's what Layout.vue reads to decide whether to even render the (lazy-loaded, see
// components/ReviewPanel.vue) panel at all.
import { ref } from "vue";

const KEY = "review-mode";

function readStored(): boolean | undefined {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "1") return true;
    if (v === "0") return false;
  } catch {
    // ignore
  }
  return undefined;
}

function persist(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    // ignore
  }
}

function computeInitial(): boolean {
  const params = new URLSearchParams(location.search);
  if (params.has("review")) {
    const v = params.get("review");
    const on = v !== "off" && v !== "0";
    persist(on);
    return on;
  }
  return readStored() ?? import.meta.env.DEV;
}

/** Module-level singleton -- one flag for the whole client session, read by
 * Layout.vue (gates rendering the panel) and by ReviewPanel.vue (its own toggle).
 * Starts `false` (matching what SSR/the build's prerender pass sees, since there's
 * no `window` there) and is set for real in `initReviewMode()`, which Layout.vue
 * calls from `onMounted` -- after hydration, so the panel never causes a mismatch. */
export const reviewModeOn = ref(false);

export function initReviewMode(): void {
  reviewModeOn.value = computeInitial();
}

export function setReviewMode(on: boolean): void {
  persist(on);
  reviewModeOn.value = on;
}

export function toggleReviewMode(): void {
  setReviewMode(!reviewModeOn.value);
}

export function isLocalhost(): boolean {
  if (typeof window === "undefined") return false;
  const h = location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "[::1]";
}
