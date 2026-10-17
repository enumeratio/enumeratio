// The web's renderer of layout boxes (https://github.com/enumeratio/enumeratio/wiki/Speculative-Box-Primitives, §2):
// `RowBox`, `GridBox`, `PanelBox`, `PaneBox` and `FrameBox` as their own tags (`row-box`), with no
// behavior of their own. The head the author wrote rides on the node (a `Row` is a tagged
// `RowBox`), and the stylesheet lays the DOM out with flex and grid, so the page keeps
// selection, find-in-page and the rest. `TableViewBox` is the one that behaves: it windows its
// rows. Pure: boxes in, a `Rendering` out, which any host turns into markup or a framework's vnodes.
//
// A hole (`TemplateSlot`) is where the environment draws a leaf itself: a control, a plot, a readout.
// One the layout left unfilled is the page's to fill from its scope (`template-slot`), and a
// `TemplateExpression` is a readout of its expression (`dynamic-box`).
// A math run is a leaf too: one `form-box` holding its TeX (`Rendering.tex`), which the host
// typesets (`box-leaf.ts`); everything around a run is drawn here.

import { type Box, type BoxNode, gridCells, isNode, optionsOfBox, type OptionValue, rowsOf } from "@enumeratio/boxes";
import { LIST_CELLS, toText } from "@enumeratio/boxes/render";
import { typesetLeaf } from "./box-leaf.ts";
import { boxTag } from "./box-tags.ts";
import { controlElement, isControlElement } from "./control-box.ts";
import { epsil } from "./mathjson.ts";
import type { Rendering } from "./symbols.ts";

/** What fills each hole, by the name the `TemplateSlot` carries. */
export type Holes = Readonly<Record<string, Rendering>>;

/**
 * The one place a box becomes an element: its head's tag (`row-box`), with the head the author
 * wrote riding on it as `data-head`. Changing how boxes are named in the DOM is an edit here, in
 * `boxTag` and in the stylesheet, which keys on the tags.
 */
function element(
  box: string,
  head: string | undefined,
  attributes: Readonly<Record<string, string>>,
  content: Pick<Rendering, "children" | "text">,
): Rendering {
  return { tag: boxTag(box), attributes: { ...(head && { "data-head": head }), ...attributes }, ...content };
}

const LAYOUT_TAGS: ReadonlySet<string> = new Set(["Row", "Grid", "Column", "Labeled"]);

/**
 * Whether `box` is mathematics, to be typeset whole: a token, a script, a fraction, a row of
 * them, a fenced matrix. Layout and interface boxes are not.
 */
function isMath(box: Box): boolean {
  if (typeof box === "string") return true;
  switch (box[0]) {
    case "RowBox":
      return box[1].every(isMath);
    case "TextBox":
    case "SuperscriptBox":
    case "SubscriptBox":
    case "SubsuperscriptBox":
    case "OverscriptBox":
    case "UnderscriptBox":
    case "UnderoverscriptBox":
    case "FractionBox":
    case "SqrtBox":
    case "RadicalBox":
      return true;
    case "TagBox":
      return !LAYOUT_TAGS.has(box[2]) && isMath(box[1]);
    case "InterpretationBox":
      return isMath(box[1]);
    case "GridBox":
      // (A lazy grid's rows are a producer, not an array.)
      return !isControlElement(box) && Array.isArray(box[1]) && box[1].every((r) => r.every(isMath));
    default:
      return false;
  }
}

/** A `TextCell`'s style as the block it is; any other is a paragraph that keeps its style for the stylesheet. */
const CELL_TAGS: Readonly<Record<string, string>> = {
  Title: "h1",
  Section: "h2",
  Subsection: "h3",
  Subsubsection: "h4",
  Subsubsubsection: "h5",
  Subsubsubsubsection: "h6",
  Quote: "blockquote",
};

/** A setter's `ButtonFunction`: `Set(_e, value)`. */
const SET_FUNCTION = /^Set\(\s*_([A-Za-z]\w*)\s*,\s*(.+?)\s*\)$/s;

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
  if (typeof box === "string") return typesetLeaf(box, "TraditionalForm");
  const children = (boxes: readonly Box[]): Pick<Rendering, "children"> => ({ children: siblings(boxes, holes) });
  switch (box[0]) {
    case "TextBox":
      return run(box[1]);
    case "RowBox":
      return isMath(box) ? typesetLeaf(box, "TraditionalForm") : element("RowBox", undefined, {}, children(box[1]));
    case "TagBox":
      return tagged(box, holes);
    case "GridBox": {
      // A bar is one control: its row of single-entry boxes is drawn as the one element.
      if (!isControlElement(box)) return grid(box, holes, undefined);
      const { tag, attributes } = controlElement(box);
      return element(tag, undefined, attributes, {});
    }
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
    case "TableViewBox":
      return tableView(box);
    case "StyleBox": {
      const options = box[2];
      const inner = renderBox(box[1], holes);
      const attributes: Record<string, string> = {
        ...(options.BaseStyle === "Label" && { class: "style-box-label" }),
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
    case "DynamicBox":
      return element("DynamicBox", undefined, { value: epsil(box[1]) }, {});
    case "DynamicModuleBox":
      return element("DynamicModuleBox", undefined, scopeAttributes(optionsOfBox(box)), children([box[1]]));
    case "TemplateSlot":
      return Object.hasOwn(holes, box[1]) ? holes[box[1]]! : slotElement(box);
    case "TemplateExpression":
      return { tag: boxTag("DynamicBox"), attributes: { value: box[1] } };
    // Running text: a string leaf is words here, not a token.
    case "TextData":
      return {
        tag: "span",
        attributes: {},
        children: box[1].map((b) => (typeof b === "string" ? run(b) : renderBox(b, holes))),
      };
    case "TooltipBox":
      return element("TooltipBox", undefined, { "data-tip": toText(box[2]), tabindex: "0" }, children([box[1]]));
    case "PaneSelectorBox": {
      const selector = box[2];
      // The whole binding expression is watched (`Dynamic(MemberQ(v, e))` too), not a toggle's variable.
      const watched: Record<string, string> = {
        selector: selectorText(epsil((selector as readonly unknown[])[1] as never)),
      };
      return element(
        "PaneSelectorBox",
        undefined,
        watched,
        // Each pane under its key, for the element to show the one the selector reads.
        {
          children: box[1].map(([key, pane]) => ({
            tag: "span",
            attributes: { "data-pane": toText(key) },
            children: [renderBox(pane, holes)],
          })),
        },
      );
    }
    case "ButtonBox":
      return button(box, holes);
    case "TextCell":
      return cell(box, holes);
    case "InterpretationBox":
      return isMath(box) ? typesetLeaf(box, "TraditionalForm") : renderBox(box[1], holes);
    case "FormBox":
      if (box[2] === "TeXForm" && isNode(box[1]) && box[1][0] === "RowBox" && box[1][1].some(isNode))
        return liveTeX(box[1][1]);
      if (box[2] === "TeXForm") return typesetLeaf(box, "TeXForm");
      return isMath(box[1]) ? typesetLeaf(box[1], box[2]) : renderBox(box[1], holes);
    case "ErrorBox":
      return renderBox(box[1], holes);
    default: {
      if (isControlElement(box)) {
        const { tag, attributes } = controlElement(box);
        return element(tag, undefined, attributes, {});
      }
      return isMath(box) ? typesetLeaf(box, "TraditionalForm") : element(box[0], undefined, {}, { text: toText(box) });
    }
  }
}

/**
 * A scope's options as attributes: `TrackedSymbols -> All | Automatic | True | {a, b}` makes it
 * reactive (`tracked-symbols`), `Evaluator -> "Worker"` evaluates in a worker.
 */
function scopeAttributes(options: Readonly<Record<string, OptionValue>>): Record<string, string> {
  const tracked = options.TrackedSymbols;
  const names = Array.isArray(tracked) ? tracked.filter((n): n is string => typeof n === "string") : [];
  return {
    ...((tracked === true || tracked === "All" || tracked === "Automatic") && { "tracked-symbols": "all" }),
    ...(names.length > 0 && { "tracked-symbols": names.join(",") }),
    ...(options.Evaluator === "Worker" && { evaluator: "worker" }),
  };
}

/** A `TagBox` that names a layout formatter: its box with that head on it. */
function tagged(box: Extract<BoxNode, readonly ["TagBox", ...unknown[]]>, holes: Holes): Rendering {
  const [, inner, name] = box;
  if (isNode(inner) && inner[0] === "RowBox" && name === "Row") {
    return element("RowBox", name, {}, { children: siblings(inner[1], holes) });
  }
  if (isNode(inner) && inner[0] === "GridBox") return grid(inner, holes, name);
  // A `StringTemplate` is its text, the head riding on it as on a layout.
  if (isNode(inner) && inner[0] === "TextData" && name === "StringTemplate") {
    return { ...renderBox(inner, holes), attributes: { "data-head": name } };
  }
  return renderBox(inner, holes);
}

/** A selector that is a bare name reads that variable, as `Dynamic(level)` does; the scope fills `_level`. */
const selectorText = (text: string): string =>
  /^[A-Za-z]\w*$/.test(text) && text !== "True" && text !== "False" ? `_${text}` : text;

/** A hole nothing filled: a variable's control (or its readout), which the page's scope picks. */
function slotElement(box: Extract<BoxNode, readonly ["TemplateSlot", ...unknown[]]>): Rendering {
  const options = Object.fromEntries(
    Object.entries(optionsOfBox(box)).flatMap(([k, v]) => (typeof v === "string" ? [[k.toLowerCase(), v]] : [])),
  );
  return { tag: "template-slot", attributes: { name: box[1], ...options } };
}

/**
 * TeX with variables in it (a `$…$` island in a template): the page's scope fills each and
 * typesets the result as it moves. The fragments ride as JSON, a hole as `{"slot": name}`.
 */
function liveTeX(items: readonly Box[]): Rendering {
  const parts = items.map((item) => (isNode(item) && item[0] === "TemplateSlot" ? { slot: item[1] } : item));
  return { tag: "template-slot", attributes: { parts: JSON.stringify(parts) } };
}

/**
 * A link is an anchor; a setter (`ButtonFunction -> Set(_e, value)`) keeps its anchor, and the
 * `button-box` around it sets the variable. No attribute holds the `_e`: the page would read it as
 * a template over the variable.
 */
function button(box: Extract<BoxNode, readonly ["ButtonBox", ...unknown[]]>, holes: Holes): Rendering {
  const options = optionsOfBox(box);
  // A label that is a string is words, not a token.
  const label = typeof box[1] === "string" ? run(box[1]) : renderBox(box[1], holes);
  const set = SET_FUNCTION.exec(string(options.ButtonFunction) ?? "");
  if (set) {
    return element(
      "ButtonBox",
      undefined,
      { set: set[1]!, to: set[2]! },
      { children: [{ tag: "a", attributes: { href: "#", class: "notatio-setter" }, children: [label] }] },
    );
  }
  const target = string(options.ButtonData);
  if (target === undefined || (options.BaseStyle !== "Link" && !isSafeTarget(target))) return label;
  // A head's page is the host's to find: the anchor names the head.
  const link: Record<string, string> = options.BaseStyle === "Link" ? { "data-link": target } : { href: target };
  return { tag: "a", attributes: link, children: [label] };
}

/** A link target the page may follow: `http:`, `https:`, `mailto:`, a fragment, or a relative path. */
const isSafeTarget = (target: string): boolean => {
  let t = "";
  for (let i = 0; i < target.length; i++) if (target.charCodeAt(i) > 32) t += target[i];
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(t)?.[1]?.toLowerCase();
  return scheme === undefined || scheme === "http" || scheme === "https" || scheme === "mailto";
};

/** A `TextCell` as its block. */
function cell(box: Extract<BoxNode, readonly ["TextCell", ...unknown[]]>, holes: Holes): Rendering {
  const [, content, style] = box;
  if (style === "Program") {
    const language = string(optionsOfBox(box).Language);
    return {
      tag: "pre",
      attributes: {},
      children: [
        {
          tag: "code",
          attributes: language === undefined ? {} : { class: `language-${language}` },
          text: typeof content === "string" ? content : toText(content),
        },
      ],
    };
  }
  if (LIST_CELLS[style]) return siblings([box], holes)[0]!;
  return {
    tag: CELL_TAGS[style] ?? "p",
    attributes: { "data-cell-style": style },
    children: [cellContent(content, holes)],
  };
}

const cellContent = (content: Box, holes: Holes): Rendering =>
  typeof content === "string" ? run(content) : renderBox(content, holes);

/**
 * Boxes side by side, where consecutive item cells (`Item`, `Subitem`, `ItemNumbered`, …) make
 * one list: a `ul` or `ol` of `li`, a deeper item a list inside the `li` above it.
 */
function siblings(boxes: readonly Box[], holes: Holes): Rendering[] {
  const out: Rendering[] = [];
  // The open lists, outermost first, each with its items so far.
  const open: { tag: "ul" | "ol"; items: Rendering[] }[] = [];
  const close = (depth: number): void => {
    while (open.length > depth) {
      const { tag, items } = open.pop()!;
      const list: Rendering = { tag, attributes: { "data-cell-list": "" }, children: items };
      const parent = open.at(-1)?.items.at(-1);
      if (parent) (parent.children as Rendering[]).push(list);
      else out.push(list);
    }
  };
  for (const box of boxes) {
    const level = isNode(box) && box[0] === "TextCell" ? LIST_CELLS[box[2]] : undefined;
    if (!level) {
      close(0);
      out.push(renderBox(box, holes));
      continue;
    }
    const [depth, tag] = level;
    const [, content, style] = box as Extract<BoxNode, readonly ["TextCell", ...unknown[]]>;
    close(depth + 1);
    // A list of the other kind at this level ends here.
    if (open.length === depth + 1 && open[depth]!.tag !== tag) close(depth);
    // A level skipped is a bullet list that opens an item of its own.
    while (open.length < depth)
      open.push({ tag: "ul", items: [{ tag: "li", attributes: { "data-placeholder": "" }, children: [] }] });
    if (open.length === depth) open.push({ tag, items: [] });
    open[depth]!.items.push({
      tag: "li",
      attributes: { "data-cell-style": style },
      children: [cellContent(content, holes)],
    });
  }
  close(0);
  return out;
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

const TABLE_ATTRIBUTES: Readonly<Record<string, string>> = {
  ScrollPosition: "scroll-position",
  MaxItems: "max-items",
};

/**
 * A `TableViewBox` as its element. The source rides as its expression (the element registers it
 * with the kernel and asks for rows by range); the headers are known before any row is, so the
 * viewport is the same size from the first paint.
 */
function tableView(box: Extract<BoxNode, readonly ["TableViewBox", ...unknown[]]>): Rendering {
  const options = optionsOfBox(box);
  const size = options.ImageSize;
  const [w, h] = Array.isArray(size) ? [number(size[0]), number(size[1])] : [number(size), undefined];
  const headers = options.TableViewBoxHeaders;
  const pinned = Object.entries(TABLE_ATTRIBUTES).flatMap(([name, attribute]) =>
    number(options[name]) === undefined ? [] : [[attribute, String(options[name])] as const],
  );
  return element(
    "TableViewBox",
    undefined,
    {
      source: JSON.stringify(box[1]),
      ...(Array.isArray(headers) && { headers: JSON.stringify(headers) }),
      ...(options.Pagination === true && { pagination: "" }),
      ...Object.fromEntries(pinned),
      ...css({ width: px(w), height: px(h) }),
    },
    {},
  );
}
