// The built-in formats. Importing this module registers them as a side effect.
// Math/code formats consume a boxed compute-engine expression; image formats
// consume an SVG string. Encoders reuse the existing transpilers/renderers; the
// engine is threaded in via opts only where a decoder needs to parse (TeX).

import type { BoxedExpression } from "@cortex-js/compute-engine";
import { compile, GLSLTarget, PythonTarget, WGSLTarget } from "@cortex-js/compute-engine/compile";
import { parseEpsil, serializeEpsil } from "@cortex-js/compute-engine/epsil";
import { fromWolfram, toWolfram } from "@enumeratio/wolfram";
import { toInputForm } from "./inputform.ts";
import { type MathMLOptions, toMathML } from "./mathml.ts";
import { parseExpression } from "./expression.ts";
import { portableTeX } from "./tex.ts";
import { type FormatOptions, type ImageValue, registerFormat } from "./registry.ts";

const asExpr = (v: unknown): BoxedExpression => v as BoxedExpression;
const asSvg = (v: unknown): string => {
  if (typeof v !== "string") throw new Error("expected an SVG string");
  return v;
};
const text = (d: string | Uint8Array): string => (typeof d === "string" ? d : Buffer.from(d).toString("utf8"));
const bytes = (d: string | Uint8Array): Uint8Array => (typeof d === "string" ? Buffer.from(d, "binary") : d);
const engine = (o?: FormatOptions) => {
  if (!o?.ce) throw new Error("this import needs an engine (opts.ce)");
  return o.ce;
};
const wolfram = (v: unknown) => toWolfram(asExpr(v).json as Parameters<typeof toWolfram>[0]);

/** Flatten an Epsil diagnostic message (a string or a `[code, ...args]` tuple). */
const diagText = (m: unknown): string => (Array.isArray(m) ? m.join(" ") : typeof m === "string" ? m : String(m));

// Epsil is compute-engine's own surface syntax (parens, `$…$` LaTeX islands).
// Output serializes via `serializeEpsil`; `$…$` islands parse via the engine's
// LaTeX parser, so a decoder needs `opts.ce`.
const epsilEncode = (v: unknown): string => serializeEpsil(asExpr(v).json);
const epsilDecode = (d: string | Uint8Array, o?: FormatOptions): unknown => {
  const ce = o?.ce;
  const options = ce ? { parseLatex: (tex: string) => ce.parse(tex)?.json } : undefined;
  const [expr, diagnostics] = parseEpsil(text(d), undefined, options);
  const errors = diagnostics.filter((x) => x.severity === "error");
  if (errors.length) throw new Error(`Epsil: ${errors.map((e) => diagText(e.message)).join("; ")}`);
  return expr;
};

// InputForm is the default display form: Epsil through the same serializer, with the
// normalization pass that makes the output re-typeable. It decodes one expression.
const inputFormDecode = (d: string | Uint8Array, o?: FormatOptions): unknown => {
  const ce = o?.ce;
  const options = ce ? { parseLatex: (tex: string) => ce.parse(tex)?.json } : undefined;
  const { json, errors } = parseExpression(text(d), options);
  if (errors.length) throw new Error(`InputForm: ${errors.join("; ")}`);
  return json;
};

registerFormat({
  name: "InputForm",
  aliases: ["inputform", "Text", "text"],
  mimeTypes: ["text/plain"],
  extensions: ["txt"],
  binary: false,
  encode: (v) => toInputForm(asExpr(v).json),
  decode: inputFormDecode,
});

registerFormat({
  name: "TeX",
  aliases: ["tex", "latex", "TeXForm"],
  mimeTypes: ["application/x-tex", "text/x-tex"],
  extensions: ["tex"],
  binary: false,
  // TeXForm is the TeX of TraditionalForm; heads with no traditional notation are unchanged.
  encode: (v) => portableTeX(asExpr(v).toLatex({ traditional: true })),
  decode: (d, o) => engine(o).parse(text(d)).json,
});

// Presentation MathML, output only. `opts.display` / `opts.fragment` pass through.
registerFormat({
  name: "MathML",
  aliases: ["mathml", "MathMLForm"],
  mimeTypes: ["application/mathml-presentation+xml", "application/mathml+xml"],
  extensions: ["mml"],
  binary: false,
  encode: (v, o) => toMathML(asExpr(v).json, o as MathMLOptions | undefined),
});

registerFormat({
  name: "MathJSON",
  aliases: ["mathjson"],
  mimeTypes: ["application/json"],
  extensions: ["json"],
  binary: false,
  encode: (v) => JSON.stringify(asExpr(v).json),
  decode: (d) => JSON.parse(text(d)),
  sniff: (d) => {
    const t = text(d).trim();
    if (!(t.startsWith("[") || t.startsWith("{"))) return false;
    try {
      JSON.parse(t);
      return true;
    } catch {
      return false;
    }
  },
});

registerFormat({
  name: "WL",
  aliases: ["Wolfram", "WolframLanguage", "wolfram", "WolframFullForm"],
  mimeTypes: ["application/vnd.wolfram.wl", "text/plain"],
  extensions: ["wl", "m"],
  binary: false,
  encode: wolfram,
  decode: (d) => fromWolfram(text(d)),
  sniff: (d) => /^[A-Z][A-Za-z0-9]*\[[\s\S]*\]\s*$/.test(text(d).trim()),
});

registerFormat({
  name: "Epsil",
  aliases: ["epsil", "ep"],
  mimeTypes: ["text/x-epsil"],
  extensions: ["epsil", "ep"],
  binary: false,
  encode: epsilEncode,
  decode: epsilDecode,
});

registerFormat({
  name: "Python",
  aliases: ["python", "numpy", "py"],
  mimeTypes: ["text/x-python"],
  extensions: ["py"],
  binary: false,
  encode: (v) => new PythonTarget().compileToSource(asExpr(v)),
});

registerFormat({
  name: "GLSL",
  aliases: ["glsl"],
  mimeTypes: ["x-shader/x-fragment"],
  extensions: ["glsl", "frag"],
  binary: false,
  encode: (v) => new GLSLTarget().compileToSource(asExpr(v)),
});

registerFormat({
  name: "WGSL",
  aliases: ["wgsl"],
  mimeTypes: ["text/wgsl"],
  extensions: ["wgsl"],
  binary: false,
  encode: (v) => new WGSLTarget().compileToSource(asExpr(v)),
});

registerFormat({
  name: "JavaScript",
  aliases: ["javascript", "js"],
  mimeTypes: ["text/javascript", "application/javascript"],
  extensions: ["js", "mjs"],
  binary: false,
  encode: (v) => compile(asExpr(v)).code,
});

registerFormat({
  name: "SVG",
  aliases: ["svg"],
  mimeTypes: ["image/svg+xml"],
  extensions: ["svg"],
  binary: false,
  encode: (v) => asSvg(v),
  // An SVG is its own graphic: import keeps the source text so it can be re-exported.
  decode: (d): ImageValue => ({
    image: true,
    mimeType: "image/svg+xml",
    data: bytes(d),
    text: text(d),
  }),
  sniff: (d) => {
    const t = text(d).trimStart();
    return t.startsWith("<svg") || (t.startsWith("<?xml") && t.includes("<svg"));
  },
});

// PNG (which needs the Node-only rasterizer) is registered by `./node`.
