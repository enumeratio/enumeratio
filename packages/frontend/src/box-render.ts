// The web's renderer of layout boxes (https://github.com/enumeratio/enumeratio/wiki/Speculative-Box-Primitives, §2):
// `RowBox`, `GridBox`, `PanelBox`, `PaneBox` and `FrameBox` as plain DOM, no custom element. The head the
// author wrote rides on the node (a `Row` is a tagged `RowBox`), and the stylesheet lays the
// DOM out with flex and grid, so the page keeps selection, find-in-page and the rest. Pure: boxes
// in, a `Rendering` out, which any host turns into markup or a framework's vnodes.
//
// A hole (`TemplateSlot`) is where the environment draws a leaf itself: a control, a plot, a readout.

import { type Box, type BoxNode, gridCells, isNode, optionsOfBox, type OptionValue, rowsOf } from "@enumeratio/boxes";
import { toText } from "@enumeratio/boxes/render";
import type { Rendering } from "./symbols.ts";

/** What fills each hole, by the name the `TemplateSlot` carries. */
export type Holes = Readonly<Record<string, Rendering>>;

/**
 * The one place a box becomes an element: which tag draws `box`, and how the box head and the
 * author's head ride on it (`data-box`, `data-head`, which the stylesheet keys on). Changing
 * how boxes are named in the DOM is an edit here and to those selectors.
 */
function element(
  box: string,
  head: string | undefined,
  attributes: Readonly<Record<string, string>>,
  content: Pick<Rendering, "children" | "text">,
): Rendering {
  const block = box === "RowBox" ? head !== undefined : box !== "StyleBox" && box !== "TextBox" && box !== "TextData";
  return {
    tag: block ? "div" : "span",
    attributes: {
      ...(box === "TextBox" ? {} : { "data-box": box }),
      ...(head && { "data-head": head }),
      ...attributes,
    },
    ...content,
  };
}

/** A run of text, which is no box worth naming in the DOM. */
const run = (text: string): Rendering => ({ tag: "span", attributes: {}, text });

const number = (value: OptionValue | undefined): number | undefined => (typeof value === "number" ? value : undefined);
const string = (value: OptionValue | undefined): string | undefined => (typeof value === "string" ? value : undefined);
const px = (n: number | undefined): string | undefined => (n === undefined ? undefined : `${n}px`);

/** `style` attribute text from declarations, or no attribute at all. */
const css = (declarations: Readonly<Record<string, string | undefined>>): Record<string, string> => {
  const text = Object.entries(declarations)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${v}`)
    .join("; ");
  return text === "" ? {} : { style: text };
};

/** A box as a rendering; `holes` fill the leaves the environment draws. */
export function renderBox(box: Box, holes: Holes = {}): Rendering {
  if (typeof box === "string") return run(box);
  const children = (boxes: readonly Box[]): Pick<Rendering, "children"> => ({
    children: boxes.map((b) => renderBox(b, holes)),
  });
  switch (box[0]) {
    case "TextBox":
      return run(box[1]);
    case "RowBox":
      return element("RowBox", undefined, {}, children(box[1]));
    case "TagBox":
      return tagged(box, holes);
    case "GridBox":
      return grid(box, holes, undefined);
    case "PanelBox": {
      const options = optionsOfBox(box);
      return element(
        "PanelBox",
        "Panel",
        css({ background: string(options.Background), width: px(number(options.ImageSize)) }),
        children([box[1]]),
      );
    }
    case "FrameBox":
      return element("FrameBox", undefined, {}, children([box[1]]));
    case "PaneBox": {
      const options = optionsOfBox(box);
      const size = options.ImageSize;
      const [w, h] = Array.isArray(size) ? [number(size[0]), number(size[1])] : [number(size), undefined];
      const scrolls = options.Scrollbars !== undefined && options.Scrollbars !== false;
      return element(
        "PaneBox",
        undefined,
        { ...(scrolls && { "data-scrollbars": "true" }), ...css({ width: px(w), height: px(h) }) },
        children([box[1]]),
      );
    }
    case "StyleBox": {
      const options = box[2];
      const inner = renderBox(box[1], holes);
      const attributes: Record<string, string> = {
        ...(options.BaseStyle === "Label" && { class: "notatio-label" }),
        ...css({
          "font-weight": options.FontWeight === "Bold" ? "bold" : undefined,
          "font-style": options.FontSlant === "Italic" ? "italic" : undefined,
          color: string(options.FontColor),
        }),
      };
      // A bare run of text takes the style itself; anything else gets a wrapper.
      return inner.tag === "span" && inner.text !== undefined && Object.keys(inner.attributes).length === 0
        ? { ...inner, attributes }
        : { tag: "span", attributes, children: [inner] };
    }
    case "TemplateSlot":
      return holes[box[1]] ?? run("");
    case "TextData":
      return { tag: "span", attributes: {}, ...children(box[1]) };
    case "InterpretationBox":
    case "ErrorBox":
    case "ButtonBox":
    case "TextCell":
    case "FormBox":
      return renderBox(box[1], holes);
    default:
      // A math run is the typesetter's; until a leaf draws it, its text.
      return element(box[0], undefined, {}, { text: toText(box) });
  }
}

/** A `TagBox` that names a layout formatter: its box with that head on it. */
function tagged(box: Extract<BoxNode, readonly ["TagBox", ...unknown[]]>, holes: Holes): Rendering {
  const [, inner, name] = box;
  if (isNode(inner) && inner[0] === "RowBox" && name === "Row") {
    return element("RowBox", name, {}, { children: inner[1].map((b) => renderBox(b, holes)) });
  }
  if (isNode(inner) && inner[0] === "GridBox") return grid(inner, holes, name);
  return renderBox(inner, holes);
}

const JUSTIFY: Readonly<Record<string, string>> = { Left: "start", Center: "center", Right: "end" };

/**
 * A grid as CSS grid, its cells the children in reading order, so a cell that is a control or a plot
 * is a child of the grid itself. A `Column` is a flex column and a `Labeled` a flex row or column;
 * those two are the shape of their cells, which the stylesheet reads off the head.
 */
function grid(
  box: Extract<BoxNode, readonly ["GridBox", ...unknown[]]>,
  holes: Holes,
  head: string | undefined,
): Rendering {
  const options = optionsOfBox(box);
  const { columns, anchors } = gridCells(rowsOf(box[1]));
  const cells = anchors.map((a) => {
    const drawn = renderBox(a.box, holes);
    if (a.cols === 1 && a.rows === 1) return drawn;
    const area = `grid-area: ${a.r + 1} / ${a.c + 1} / span ${a.rows} / span ${a.cols}`;
    const style = [drawn.attributes.style, area].filter((s) => s !== undefined).join("; ");
    return { ...drawn, attributes: { ...drawn.attributes, style } };
  });
  const aligned = options.ColumnAlignments;
  const alignment = Array.isArray(aligned) ? string(aligned[0]) : string(aligned);
  const spacing = number(options.ColumnSpacings);
  const rowSpacing = number(options.RowSpacings);
  const tabular = head === undefined || head === "Grid";
  return element(
    "GridBox",
    head,
    {
      ...(head === "Labeled" && rowsOf(box[1]).length > 1 && { "data-rows": "2" }),
      ...(options.GridBoxFrame === true && { "data-frame": "true" }),
      ...(options.GridBoxDividers !== undefined && { "data-dividers": "All" }),
      ...css({
        "grid-template-columns": tabular ? `repeat(${Math.max(1, columns)}, auto)` : undefined,
        "justify-items": alignment === undefined ? undefined : JUSTIFY[alignment],
        "column-gap": spacing === undefined ? undefined : `${spacing}em`,
        "row-gap": rowSpacing === undefined ? undefined : `${rowSpacing}em`,
      }),
    },
    { children: cells },
  );
}
