// Building an "ad-hoc" review item from a modifier-click on an anchored page element
// (see ReviewPanel.vue's document-level click handler). Pure and DOM-free so it's
// unit-testable like backlog.ts/link.ts; no fs or localStorage access here.
//
// The element's id (the anchor) is always treated as an opaque string -- never parsed
// for shape. ReferencePage's `#example-N` anchors are one shape today; a later
// migration may replace them with something else entirely (e.g. `#example/<id>`),
// with no redirects, so nothing here may assume digits, dashes, or any particular
// pattern. An ad-hoc item's `- link:` is built the same way an existing item's is
// (an absolute `https://enumeratio.dev/...#anchor` URL), so a later relink pass can
// rewrite it exactly like any other item.
import type { BacklogItem, Bullet } from "./backlog.ts";

const PROD_ORIGIN = "https://enumeratio.dev";

/** `https://enumeratio.dev<path>#<anchor>` -- the same absolute form existing items'
 * `- link:` lines use (see backlog.golden.json), regardless of the host the reviewer
 * is actually browsing from (localhost, a CF preview, prod itself). */
export function buildProdLink(path: string, anchor: string): string {
  return `${PROD_ORIGIN}${path}#${anchor}`;
}

// FNV-1a, 32-bit: deterministic and dependency-free, just enough to key a slug.
// Not used for anything security-sensitive.
function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** A stable id for `path#anchor`, fit to the backlog heading's id charset
 * (`[A-Za-z0-9_-]+`, see HEADING_RE in backlog.ts). Built from a truncated slug plus
 * a hash of the full opaque string, so two different (path, anchor) pairs that slug
 * down to the same prefix still get distinct ids. */
export function adhocId(path: string, anchor: string): string {
  const slug = `${path}-${anchor}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `adhoc-${slug}-${fnv1a(`${path}#${anchor}`)}`;
}

/** "Arccos · example-19" -- the page's own label plus the anchor text verbatim. The
 * anchor is never reformatted (no "example 19", no stripped prefix): its shape isn't
 * ours to interpret. */
export function adhocTitle(pageLabel: string, anchor: string): string {
  return `${pageLabel} · ${anchor}`;
}

export function buildAdhocItem(pageLabel: string, path: string, anchor: string): BacklogItem {
  const link = buildProdLink(path, anchor);
  const bullets: Bullet[] = [{ key: "link", value: link }];
  return {
    id: adhocId(path, anchor),
    title: adhocTitle(pageLabel, anchor),
    status: "open",
    link,
    bullets,
    feedback: "",
  };
}
