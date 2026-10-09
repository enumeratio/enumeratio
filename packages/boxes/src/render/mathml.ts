// Boxes as presentation MathML, and back. The math boxes are MathML Core's elements one
// for one; `FrameBox` is an `mrow` with a CSS border (Core has no `menclose`), marked
// `data-box` so the reader knows it; `InterpretationBox` and `TagBox` are `semantics`
// with the expression or the tag as the annotation. Output is deterministic --
// attributes in a fixed order -- so it can be golden-tested.

import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import {
  type Box,
  type BoxNode,
  error,
  fraction,
  frame,
  panel,
  grid,
  interpretation,
  type Options,
  optionsOfBox,
  overscript,
  radical,
  row,
  sqrt,
  style,
  subscript,
  subsuperscript,
  superscript,
  tag,
  text,
  tokenClass,
  underoverscript,
  underscript,
} from "../box.ts";
import { texSource } from "./markdown.ts";

export interface MathMLOptions {
  /** `display="block"` on the `<math>` root (default inline). */
  display?: "block" | "inline";
  /** Emit the bare content without the `<math>` root. */
  fragment?: boolean;
}

const MATHML_NS = "http://www.w3.org/1998/Math/MathML";
/** MathJSON's media type: RFC 6839's `+json` suffix on the format's own name. Unregistered. */
export const MATHJSON_MIME = "application/mathjson+json";
export const TAG_ENCODING = "application/x-box-tag";
const FRAME_STYLE = "border:1px solid currentColor;padding:0.1em 0.2em";

/** The invisible operators, written as character references so they show in source. */
const INVISIBLE = /[\u2061-\u2064]/g;

const escape = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(INVISIBLE, (c) => `&#x${c.codePointAt(0)!.toString(16)};`);

const element = (name: string, content: string, attrs: Record<string, string | undefined> = {}): string => {
  const written = Object.entries(attrs)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ` ${k}="${escape(v!)}"`)
    .join("");
  return `<${name}${written}>${content}</${name}>`;
};

const TOKEN_ELEMENT = { identifier: "mi", number: "mn", operator: "mo" } as const;

/** `StyleBox` options onto `mstyle` attributes; the rest go into `style`. */
function styleAttrs(options: Options): Record<string, string | undefined> {
  const css: string[] = [];
  if (options.FontWeight !== undefined) css.push(`font-weight:${String(options.FontWeight).toLowerCase()}`);
  if (options.FontSlant !== undefined) css.push(`font-style:${String(options.FontSlant).toLowerCase()}`);
  return {
    mathcolor: options.FontColor === undefined ? undefined : String(options.FontColor),
    mathbackground: options.Background === undefined ? undefined : String(options.Background),
    mathsize: options.FontSize === undefined ? undefined : `${String(options.FontSize)}px`,
    style: css.length === 0 ? undefined : css.join(";"),
  };
}

function write(box: Box): string {
  if (typeof box === "string") return element(TOKEN_ELEMENT[tokenClass(box)], escape(box));
  return writeNode(box);
}

function writeNode(box: BoxNode): string {
  const options = optionsOfBox(box);
  switch (box[0]) {
    case "RowBox":
      return element("mrow", box[1].map(write).join(""));
    case "TextBox":
      return element(options.ShowStringCharacters === true ? "ms" : "mtext", escape(box[1]));
    case "SuperscriptBox":
      return element("msup", write(box[1]) + write(box[2]));
    case "SubscriptBox":
      return element("msub", write(box[1]) + write(box[2]));
    case "SubsuperscriptBox":
      return element("msubsup", write(box[1]) + write(box[2]) + write(box[3]));
    case "OverscriptBox":
      return element("mover", write(box[1]) + write(box[2]));
    case "UnderscriptBox":
      return element("munder", write(box[1]) + write(box[2]));
    case "UnderoverscriptBox":
      return element("munderover", write(box[1]) + write(box[2]) + write(box[3]));
    case "FractionBox":
      return element("mfrac", write(box[1]) + write(box[2]), {
        linethickness: options.FractionLine === false ? "0" : undefined,
      });
    case "SqrtBox":
      return element("msqrt", write(box[1]));
    case "RadicalBox":
      return element("mroot", write(box[1]) + write(box[2]));
    case "GridBox":
      return element(
        "mtable",
        box[1].map((r) => element("mtr", r.map((cell) => element("mtd", write(cell))).join(""))).join(""),
      );
    case "StyleBox":
      return element("mstyle", write(box[1]), styleAttrs(box[2]));
    case "FrameBox":
    case "PanelBox":
      return element("mrow", write(box[1]), { "data-box": box[0], style: FRAME_STYLE });
    case "PaneBox":
      return write(box[1]);
    case "TagBox":
      return element("semantics", write(box[1]) + element("annotation", escape(box[2]), { encoding: TAG_ENCODING }));
    case "InterpretationBox":
      return element(
        "semantics",
        write(box[1]) + element("annotation", escape(JSON.stringify(box[2])), { encoding: MATHJSON_MIME }),
      );
    case "ErrorBox":
      return element("merror", write(box[1]));
    case "GraphicsBox":
    case "GraphicsComplexBox":
    case "DiskBox":
    case "LineBox":
    case "PolygonBox":
    case "PolyhedronBox":
    case "InsetBox":
      return element("mtext", "-Graphics-");
    case "TableViewBox":
      return element("mtext", "-TableView-");
    case "DynamicBox":
      return element("mtext", "-Dynamic-");
    case "DynamicModuleBox":
      return write(box[1]);
    case "SliderBox":
    case "Slider2DBox":
    case "CheckboxBox":
    case "PopupMenuBox":
    case "InputFieldBox":
    case "SetterBox":
    case "TogglerBox":
    case "AnimatorBox":
    case "KnobBox":
    case "StepperBox":
    case "IntervalSliderBox":
    case "ListPickerBox":
    case "LocatorBox":
    case "ColorSetterBox":
    case "SetterBarBox":
    case "RadioButtonBarBox":
    case "TogglerBarBox":
      return element("mtext", `-${box[0].slice(0, -3)}-`);
    case "ButtonBox":
    case "TextCell":
      return write(box[1]);
    case "TextData":
      return element(
        "mrow",
        box[1].map((b) => (typeof b === "string" ? element("mtext", escape(b)) : write(b))).join(""),
      );
    // Held TeX isn't parsed: its source, annotated as TeX.
    case "FormBox":
      return box[2] === "TeXForm"
        ? element(
            "semantics",
            element("mtext", escape(texSource(box[1]))) +
              element("annotation", escape(texSource(box[1])), { encoding: "application/x-tex" }),
          )
        : write(box[1]);
    case "TemplateSlot":
    case "TemplateExpression":
      return element("mtext", escape(`\${${box[1]}}`));
    default:
      throw new Error("unreachable: BoxNode's tags are exhaustive above");
  }
}

/** Boxes as presentation MathML. */
export function toMathML(box: Box, options: MathMLOptions = {}): string {
  const inner = write(box);
  if (options.fragment) return inner;
  return element("math", inner, { xmlns: MATHML_NS, display: options.display === "block" ? "block" : undefined });
}

// ---------------------------------------------------------------------------------------
// Reading. A small XML reader, enough for MathML: elements, attributes, text, character
// references. No DOM, so it runs in Node as well as the browser.

interface XmlElement {
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
}
type XmlNode = XmlElement | string;

export class MathMLSyntaxError extends Error {
  override name = "MathMLSyntaxError";
}

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0" };

const unescape = (s: string): string =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, ref: string) => {
    if (ref[0] === "#") {
      const code = ref[1] === "x" || ref[1] === "X" ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      return String.fromCodePoint(code);
    }
    return NAMED[ref] ?? whole;
  });

function parseXml(source: string): XmlElement {
  let i = 0;
  const fail = (what: string): never => {
    throw new MathMLSyntaxError(`${what} at ${i}`);
  };
  const skipMisc = () => {
    for (;;) {
      if (source.startsWith("<!--", i)) {
        const end = source.indexOf("-->", i);
        i = end < 0 ? fail("unterminated comment") : end + 3;
      } else if (source.startsWith("<?", i)) {
        const end = source.indexOf("?>", i);
        i = end < 0 ? fail("unterminated declaration") : end + 2;
      } else if (/\s/.test(source[i] ?? "")) i++;
      else return;
    }
  };

  function parseElement(): XmlElement {
    const open = /^<([A-Za-z][\w:.-]*)/.exec(source.slice(i));
    if (!open) return fail("expected an element");
    i += open[0].length;
    const name = open[1].replace(/^m:/, "");
    const attrs: Record<string, string> = {};
    for (;;) {
      const attr = /^\s+([A-Za-z_][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/.exec(source.slice(i));
      if (!attr) break;
      attrs[attr[1]] = unescape(attr[3] ?? attr[4]);
      i += attr[0].length;
    }
    const close = /^\s*(\/?)>/.exec(source.slice(i));
    if (!close) return fail(`malformed <${name}>`);
    i += close[0].length;
    const children: XmlNode[] = [];
    if (close[1]) return { name, attrs, children };
    for (;;) {
      if (i >= source.length) return fail(`unclosed <${name}>`);
      if (source.startsWith("</", i)) {
        const end = /^<\/([A-Za-z][\w:.-]*)\s*>/.exec(source.slice(i));
        if (!end || end[1].replace(/^m:/, "") !== name) return fail(`mismatched </…> for <${name}>`);
        i += end[0].length;
        return { name, attrs, children };
      }
      if (source.startsWith("<!--", i)) {
        skipMisc();
        continue;
      }
      if (source[i] === "<") {
        children.push(parseElement());
        continue;
      }
      const next = source.indexOf("<", i);
      const raw = source.slice(i, next < 0 ? source.length : next);
      i += raw.length;
      children.push(unescape(raw));
    }
  }

  skipMisc();
  const root = parseElement();
  skipMisc();
  if (i < source.length) fail("content after the root element");
  return root;
}

const elements = (el: XmlElement): XmlElement[] => el.children.filter((c): c is XmlElement => typeof c !== "string");
const textOf = (el: XmlElement): string => el.children.filter((c) => typeof c === "string").join("");

/** Several children are an inferred `mrow`; one is itself. */
const inferred = (el: XmlElement): Box => {
  const kids = elements(el).map(read);
  return kids.length === 1 ? kids[0] : row(kids);
};

function arg(el: XmlElement, n: number): Box {
  const kid = elements(el)[n];
  if (kid === undefined) throw new MathMLSyntaxError(`<${el.name}> needs ${n + 1} children`);
  return read(kid);
}

function styleOptions(el: XmlElement): Options {
  const options: Record<string, string | number> = {};
  if (el.attrs.mathcolor !== undefined) options.FontColor = el.attrs.mathcolor;
  if (el.attrs.mathbackground !== undefined) options.Background = el.attrs.mathbackground;
  const size = /^(\d+(?:\.\d+)?)px$/.exec(el.attrs.mathsize ?? "");
  if (size) options.FontSize = Number(size[1]);
  for (const decl of (el.attrs.style ?? "").split(";")) {
    const [prop, value] = decl.split(":").map((s) => s.trim());
    const capital = value ? value[0].toUpperCase() + value.slice(1) : "";
    if (prop === "font-weight") options.FontWeight = capital;
    if (prop === "font-style") options.FontSlant = capital;
  }
  return options;
}

function read(el: XmlElement): Box {
  switch (el.name) {
    case "math":
    case "mrow":
      if (el.attrs["data-box"] === "FrameBox") return frame(inferred(el));
      if (el.attrs["data-box"] === "PanelBox") return panel(inferred(el));
      return el.name === "math" ? inferred(el) : row(elements(el).map(read));
    case "mi":
    case "mn":
    case "mo":
      return textOf(el).trim();
    case "mtext":
      return text(textOf(el));
    case "ms":
      return text(textOf(el), { ShowStringCharacters: true });
    case "msup":
      return superscript(arg(el, 0), arg(el, 1));
    case "msub":
      return subscript(arg(el, 0), arg(el, 1));
    case "msubsup":
      return subsuperscript(arg(el, 0), arg(el, 1), arg(el, 2));
    case "mover":
      return overscript(arg(el, 0), arg(el, 1));
    case "munder":
      return underscript(arg(el, 0), arg(el, 1));
    case "munderover":
      return underoverscript(arg(el, 0), arg(el, 1), arg(el, 2));
    case "mfrac": {
      const thickness = el.attrs.linethickness;
      const hidden = thickness !== undefined && parseFloat(thickness) === 0;
      return fraction(arg(el, 0), arg(el, 1), hidden ? { FractionLine: false } : undefined);
    }
    case "msqrt":
      return sqrt(inferred(el));
    case "mroot":
      return radical(arg(el, 0), arg(el, 1));
    case "mtable":
      return grid(elements(el).map((tr) => elements(tr).map(inferred)));
    case "mstyle":
      return style(inferred(el), styleOptions(el));
    case "merror":
      return error(inferred(el));
    case "semantics": {
      const [shown, ...annotations] = elements(el);
      if (shown === undefined) throw new MathMLSyntaxError("<semantics> needs a child");
      const boxes = read(shown);
      for (const a of annotations) {
        if (a.attrs.encoding === MATHJSON_MIME) {
          return interpretation(boxes, JSON.parse(textOf(a)) as MathJsonExpression);
        }
        if (a.attrs.encoding === TAG_ENCODING) return tag(boxes, textOf(a));
      }
      return boxes;
    }
    // Spacing and phantoms carry no content a box keeps yet.
    case "mspace":
    case "mphantom":
      return "";
    default:
      // An element outside the vocabulary: keep its content, drop the element.
      return inferred(el);
  }
}

/** Presentation MathML as boxes. Throws `MathMLSyntaxError` on malformed markup. */
export const parseMathML = (source: string): Box => read(parseXml(source));
