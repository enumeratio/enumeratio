// The web's one map from a box head to its tag (https://github.com/enumeratio/enumeratio/wiki/Speculative-Box-Primitives, decision 2):
// the head in kebab case, `RowBox` -> `row-box`, so web markup is the box tree itself and the
// suffix meets the custom-element hyphen rule without a brand.

import { BAR_KINDS, BOX_HEADS } from "@enumeratio/boxes";

/**
 * `head` in kebab case, broken before each capital that follows a lowercase letter and before each
 * run of digits; a capital straight after digits stays with them: `Graphics3DBox` -> `graphics-3d-box`.
 */
export const boxTag = (head: string): string =>
  head
    .replace(/(?<=[a-z])(?=[A-Z])/g, "-")
    .replace(/(?<=[A-Za-z])(?=\d)/g, "-")
    .replace(/(?<=[A-Z])(?=[A-Z][a-z])/g, "-")
    .toLowerCase();

/** The box heads drawn as elements: the ones named `…Box` (a `TextData` or a `TemplateSlot` is no element). */
export const BOX_TAG_HEADS: readonly string[] = BOX_HEADS.filter((h) => h.endsWith("Box"));

/** Every box tag the web registers. */
export const BOX_TAGS: readonly string[] = BOX_TAG_HEADS.map(boxTag);

/**
 * The tags of the bars: a row of single-entry boxes sharing a binding is drawn as one element
 * (`setter-bar-box`), though no box head is named for it.
 */
export const BAR_TAGS: readonly string[] = BAR_KINDS.map((kind) => boxTag(`${kind}Box`));

/** Whether `tag` is a box's, or a bar's. */
export const isBoxTag = (tag: string): boolean => BOX_TAGS.includes(tag) || BAR_TAGS.includes(tag);
