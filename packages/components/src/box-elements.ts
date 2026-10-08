// Every box primitive is its own tag (https://github.com/enumeratio/enumeratio/wiki/Speculative-Box-Primitives, decision 2), so
// the markup is the box tree and `:defined` holds for all of them. A box with no behavior of its
// own is an empty element the stylesheet lays out; one that takes input or has a lifecycle
// (`table-view-box`) is its own module, loaded when a page uses it (`./lazy.ts`).
//
// A tag someone else already defined is theirs: we log it once and leave it, and the stylesheet,
// keyed on the tag, keeps drawing. A host that wants other names registers these in a scoped
// registry (`defineBoxElements(registry)`).

import { BOX_TAGS } from "@enumeratio/frontend/box-tags";
import { debug } from "@enumeratio/frontend/core";

const log = debug("box-elements");

type Registry = Pick<CustomElementRegistry, "define" | "get">;

/** The box tags with a module of their own. */
export const INTERACTIVE_BOX_TAGS: ReadonlySet<string> = new Set(["table-view-box"]);

/** The tags `defineBoxElements` leaves to their own modules. */
export const PLAIN_BOX_TAGS: readonly string[] = BOX_TAGS.filter((tag) => !INTERACTIVE_BOX_TAGS.has(tag));

/** What we defined in each registry, so a second call is quiet and a stranger's definition is not. */
const ours = new WeakMap<Registry, Set<string>>();

/** Define an empty element for each box without behavior; idempotent. */
export function defineBoxElements(registry: Registry = customElements): void {
  const mine = ours.get(registry) ?? new Set<string>();
  ours.set(registry, mine);
  for (const tag of PLAIN_BOX_TAGS) {
    if (mine.has(tag)) continue;
    if (registry.get(tag) !== undefined) {
      log(`<${tag}> is already defined; leaving it`);
      mine.add(tag);
      continue;
    }
    registry.define(tag, class extends HTMLElement {});
    mine.add(tag);
  }
}
