// A value's source in each code form compute-engine compiles to: Python, GLSL and WGSL
// through their targets, JavaScript through `compile()`. Each only takes a numeric or
// function expression, so a list or a comparison simply has no source in that form.

import { type ComputeEngine, compile, GLSLTarget, PythonTarget, WGSLTarget } from "@cortex-js/compute-engine";

export type CodeForm = "python" | "glsl" | "wgsl" | "javascript";

const TARGETS = { python: PythonTarget, glsl: GLSLTarget, wgsl: WGSLTarget } as const;

/** `json`'s source in each code form that can compile it. */
export function codeForms(ce: ComputeEngine, json: unknown): Partial<Record<CodeForm, string>> {
  const out: Partial<Record<CodeForm, string>> = {};
  const expr = ce.box(json as never);
  for (const [form, Target] of Object.entries(TARGETS)) {
    try {
      const source = (new Target() as unknown as { compileToSource(e: unknown): unknown }).compileToSource(expr);
      if (typeof source === "string") out[form as CodeForm] = source;
    } catch {
      // this target can't compile this expression
    }
  }
  try {
    const code = (compile(json as never, { engine: ce } as never) as { code?: unknown } | undefined)?.code;
    if (typeof code === "string") out.javascript = code;
  } catch {
    // not compilable to JavaScript
  }
  return out;
}
