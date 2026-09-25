// Pure rewriter for a review item's `link` field, used by the review sidebar to
// decide whether selecting an item can navigate the site itself (VitePress's own
// router) or must fall back to an "Open in new tab" link. No DOM/router access here
// -- see ReviewPanel.vue for how the result is used -- so this stays unit-testable
// without mounting anything.

const PROD_HOST = "enumeratio.dev";
// `<sha7>.enumeratio.pages.dev` -- the per-commit Cloudflare Pages preview (see
// AGENTS.md's CI-and-deployment section). A 7-hex-digit short SHA subdomain.
const PREVIEW_HOST_RE = /^[0-9a-f]{7}\.enumeratio\.pages\.dev$/;

export type ResolvedReviewLink = { kind: "local"; path: string } | { kind: "external"; href: string };

/**
 * Resolve a backlog item's `link` for the review sidebar:
 * - a same-site path (already relative, or absolute with no host) navigates locally as-is.
 * - `https://enumeratio.dev/<path>` and `https://<sha7>.enumeratio.pages.dev/<path>` rewrite
 *   to the local `<path>` (plus search/hash) -- framing or opening the live site is pointless
 *   when the reviewer is looking at the same page locally.
 * - anything else (github.com, other hosts, or an unparsable string) is left external, to be
 *   rendered as an "Open in new tab" link rather than navigated to.
 */
export function resolveReviewLink(link: string): ResolvedReviewLink {
  const trimmed = link.trim();
  if (trimmed === "") return { kind: "external", href: link };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    // Not an absolute URL -- treat as an already-local path.
    return { kind: "local", path: trimmed };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { kind: "external", href: link };
  }
  if (url.hostname === PROD_HOST || PREVIEW_HOST_RE.test(url.hostname)) {
    return { kind: "local", path: `${url.pathname}${url.search}${url.hash}` };
  }
  return { kind: "external", href: link };
}

/**
 * Split a resolved local path's fragment off, for callers (the persistent-highlight
 * watcher) that need the page path and the target element's id separately. The id is
 * returned decoded and without its leading `#`; it's treated as an opaque string, the
 * same as everywhere else in review mode -- never parsed for shape.
 */
export function splitHash(path: string): { path: string; id: string } {
  const i = path.indexOf("#");
  if (i === -1) return { path, id: "" };
  return { path: path.slice(0, i), id: decodeURIComponent(path.slice(i + 1)) };
}
