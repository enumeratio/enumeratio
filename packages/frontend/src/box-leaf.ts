// The typeset leaf and the markup of a rendering (https://github.com/enumeratio/enumeratio/wiki/Speculative-Box-Primitives, §2): a
// math run is one `form-box` that holds its TeX, and the host typesets it. Apart from
// `box-render.ts` because the front end's core, which loads no engine, draws a leaf too.

import type { Box } from "@enumeratio/boxes";
import { toLatex, toText } from "@enumeratio/boxes/render";
import { boxTag } from "./box-tags.ts";
import type { Rendering } from "./symbols.ts";

/**
 * A math run as the one leaf the host typesets: `form` is how the box reads (`TeXForm` holds TeX
 * as written), `text` what it reads as until typeset. An `InterpretationBox` keeps its
 * expression on the leaf (`\htmlData`).
 */
export function typesetLeaf(box: Box, form: string): Rendering {
  const tex = toLatex(box, { data: true });
  return {
    tag: boxTag("FormBox"),
    attributes: { "data-form": form },
    text: form === "TeXForm" ? tex : toText(box),
    tex,
  };
}

/** Escape a value for a double-quoted HTML attribute. */
const attr = (value: string): string => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/**
 * A rendering as markup, for a host that can only take HTML. `typeset` turns a math run's TeX
 * into markup; without one a run shows its text.
 */
export function markupOf(rendering: Rendering, typeset?: (tex: string) => string): string {
  const attributes = Object.entries(rendering.attributes)
    .map(([k, v]) => ` ${k}="${attr(v)}"`)
    .join("");
  if (rendering.tag === "img") return `<img${attributes}>`;
  const inner =
    rendering.tex !== undefined && typeset !== undefined
      ? typeset(rendering.tex)
      : rendering.text !== undefined
        ? rendering.text.replace(/&/g, "&amp;").replace(/</g, "&lt;")
        : (rendering.children?.map((c) => markupOf(c, typeset)).join("") ?? "");
  return `<${rendering.tag}${attributes}>${inner}</${rendering.tag}>`;
}
