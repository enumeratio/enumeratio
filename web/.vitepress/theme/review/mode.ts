// Review mode's on/off switch. It exists only under `vitepress dev`, or in a build made
// with `VITE_REVIEW=1`; prod and the CF previews never have it. Where it exists it is off
// until the URL has `?review` (or lands on `/review`); once entered it stays on for this
// tab (sessionStorage) until `?review=off` or the panel's exit button. This module is small,
// so it's fine in the main bundle -- Layout.vue reads it to decide whether to render the
// (lazy-loaded, see components/ReviewPanel.vue) panel at all.
import { ref } from "vue";

const KEY = "review-mode";

/** Build-time: false in a prod build, so the panel's chunk is never even requested there. */
export const REVIEW_AVAILABLE: boolean = import.meta.env.DEV || import.meta.env["VITE_REVIEW"] === "1";

function readStored(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function persist(on: boolean): void {
  try {
    if (on) sessionStorage.setItem(KEY, "1");
    else sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

function computeInitial(): boolean {
  if (!REVIEW_AVAILABLE) return false;
  const params = new URLSearchParams(location.search);
  if (params.has("review")) {
    const v = params.get("review");
    const on = v !== "off" && v !== "0";
    persist(on);
    return on;
  }
  if (/^\/review(\.html|\/)?$/.test(location.pathname)) return true;
  return readStored();
}

/** Module-level singleton -- one flag for the whole client session, read by
 * Layout.vue (gates rendering the panel) and by ReviewPanel.vue (its exit button).
 * Starts `false` (matching what SSR/the build's prerender pass sees, since there's
 * no `window` there) and is set for real in `initReviewMode()`, which Layout.vue
 * calls from `onMounted` -- after hydration, so the panel never causes a mismatch. */
export const reviewModeOn = ref(false);

export function initReviewMode(): void {
  reviewModeOn.value = computeInitial();
}

export function setReviewMode(on: boolean): void {
  if (!REVIEW_AVAILABLE) return;
  persist(on);
  reviewModeOn.value = on;
}

export function isLocalhost(): boolean {
  if (typeof window === "undefined") return false;
  const h = location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "[::1]";
}
