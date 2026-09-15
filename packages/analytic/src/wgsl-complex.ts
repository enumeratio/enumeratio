// Emit WGSL that evaluates a MathJSON expression as a *complex* value (vec2f),
// for per-pixel domain coloring. compute-engine's own WGSL target is real-scalar —
// our `realCompile` handlers take `.x` off the kernels — which is right for plotting
// a surface and useless for a portrait, where the phase is the whole picture.
//
// Two things make this worth its own emitter rather than a second CE target:
//  • every arithmetic node needs the complex form (`cmul`, not `*`), which is a
//    different lowering of the operators, not a different spelling of them;
//  • numeric literals are hoisted into uniform slots rather than baked into the
//    source. `<notatio-manipulate>` drives a portrait by substituting a number into
//    the expression, so the expression text changes every frame — but its *shape*
//    does not, and a shape that has not changed can keep its compiled pipeline and
//    just re-upload the slots. That is the difference between rebuilding a shader
//    module per frame and writing 8 bytes per frame.
//
// The emitted body assumes `zetaWGSL` is in scope (for the special-function kernels
// and the complex helpers), a `vec2f` named by `variable` holding the point being
// coloured, and a uniform `prm.p : array<vec4f, MAX_SLOTS>` holding the literals —
// vec4f because a uniform array's element stride is rounded up to 16 bytes, so a
// packed `array<vec2f, N>` is not addressable. Only `.xy` of each slot is read.

/** MathJSON, in the canonical plain-array form `ce.box(expr).json` returns. */
export type Json = number | string | boolean | { [k: string]: unknown } | Json[];

export interface ComplexWGSL {
  /** A WGSL expression of type `vec2f`. */
  readonly code: string;
  /** Literal values, in slot order, to upload as `prm.p`. */
  readonly literals: readonly (readonly [number, number])[];
  /**
   * The expression with every literal replaced by its slot — equal shapes compile to
   * identical `code`, so this is the pipeline cache key.
   */
  readonly shape: string;
}

/** Max literal slots; a portrait with more than this many constants is rejected. */
export const MAX_SLOTS = 16;

const asArray = (j: Json): Json[] | undefined => (Array.isArray(j) ? j : undefined);

/** A MathJSON symbol name, whatever encoding it arrived in. */
const symbolOf = (j: Json): string | undefined => {
  if (typeof j === "string") return j;
  if (typeof j === "object" && j !== null && !Array.isArray(j)) {
    const sym = (j as { sym?: unknown }).sym;
    if (typeof sym === "string") return sym;
  }
  return undefined;
};

/**
 * A MathJSON number literal, as a real; `undefined` if the node is not one.
 *
 * `Rational` counts: an exact result carries them everywhere (ζ(0, z) is 1/2 − z, and
 * every ζ(−n, z) is a Bernoulli polynomial made of them), so treating one as a call
 * rather than a literal makes those undrawable.
 */
const numberOf = (j: Json): number | undefined => {
  if (typeof j === "number") return j;
  if (Array.isArray(j) && j.length === 3 && symbolOf(j[0] as Json) === "Rational") {
    const p = numberOf(j[1] as Json);
    const q = numberOf(j[2] as Json);
    return p !== undefined && q !== undefined && q !== 0 ? p / q : undefined;
  }
  if (typeof j === "object" && j !== null && !Array.isArray(j)) {
    const num = (j as { num?: unknown }).num;
    if (typeof num === "string") {
      const v = Number(num.replace(/_/g, ""));
      return Number.isFinite(v) ? v : undefined;
    }
  }
  return undefined;
};

/** Named constants that lower to a literal complex value. */
const CONSTANTS: Record<string, [number, number]> = {
  Pi: [Math.PI, 0],
  ExponentialE: [Math.E, 0],
  ImaginaryUnit: [0, 1],
  EulerGamma: [0.5772156649015329, 0],
  GoldenRatio: [(1 + Math.sqrt(5)) / 2, 0],
  CatalanConstant: [0.915965594177219, 0],
};

/**
 * Special-function heads, by arity, naming the `zetaWGSL` kernel they call. The
 * argument order matches the head's own.
 */
const KERNELS: Record<string, { fn: string; arity: number }> = {
  HurwitzZeta: { fn: "hurwitz", arity: 2 },
  LerchPhi: { fn: "lerchPhi", arity: 3 },
  PolyLog: { fn: "polyLog", arity: 2 },
  PolyGamma: { fn: "polygamma", arity: 2 },
  Mandelbrot: { fn: "mandelbrot", arity: 2 },
  Julia: { fn: "julia", arity: 3 },
};

/** `ln` -> `Ln`: a round trip through notatio can hand back a lowercase head. */
const capitalize = (name: string): string => name.charAt(0).toUpperCase() + name.slice(1);

/** Unary functions with a complex WGSL counterpart in `zetaWGSL`. */
const UNARY: Record<string, string> = {
  Exp: "cexp",
  Ln: "clog",
  Sqrt: "csqrt",
  Sin: "csin",
  Cos: "ccos",
  Sinh: "csinh",
  Cosh: "ccosh",
  Negate: "cneg",
  Conjugate: "cconj",
};

class Emitter {
  readonly literals: [number, number][] = [];
  // A plain field rather than a constructor parameter property: those are not
  // strip-only TypeScript, so they break `node script.ts` for the analysis scripts.
  private readonly variable: string;
  private readonly shapeParts: string[] = [];

  constructor(variable: string) {
    this.variable = variable;
  }

  /** Record a literal and return the WGSL that reads its slot. */
  private slot(re: number, im: number): string {
    if (this.literals.length >= MAX_SLOTS) throw new Error("too many literals");
    const i = this.literals.length;
    this.literals.push([re, im]);
    return `prm.p[${i}].xy`;
  }

  shape(): string {
    return this.shapeParts.join("");
  }

  emit(j: Json): string {
    const n = numberOf(j);
    if (n !== undefined) {
      this.shapeParts.push("#");
      return this.slot(n, 0);
    }

    const sym = symbolOf(j);
    if (sym !== undefined) {
      if (sym === this.variable) {
        this.shapeParts.push("$");
        return this.variable;
      }
      const k = CONSTANTS[sym];
      if (k) {
        this.shapeParts.push("#");
        return this.slot(k[0], k[1]);
      }
      throw new Error(`unbound symbol ${sym}`);
    }

    const ops = asArray(j);
    const head = ops ? symbolOf(ops[0] as Json) : undefined;
    if (!ops || head === undefined) throw new Error("unsupported node");
    const args = ops.slice(1) as Json[];

    // A complex literal is a leaf, not a call.
    if (head === "Complex" && args.length === 2) {
      const re = numberOf(args[0]);
      const im = numberOf(args[1]);
      if (re === undefined || im === undefined) throw new Error("non-literal Complex");
      this.shapeParts.push("#");
      return this.slot(re, im);
    }

    this.shapeParts.push(`(${head}`);
    const code = this.emitCall(head, args);
    this.shapeParts.push(")");
    return code;
  }

  private emitCall(head: string, args: Json[]): string {
    const sub = (i: number): string => this.emit(args[i] as Json);

    switch (head) {
      case "Add":
        if (args.length < 2) break;
        return `(${args.map((_, i) => sub(i)).join(" + ")})`;
      case "Subtract":
        if (args.length !== 2) break;
        return `(${sub(0)} - ${sub(1)})`;
      case "Multiply": {
        if (args.length < 2) break;
        // cmul is binary; fold left so an n-ary product nests.
        return args.map((_, i) => sub(i)).reduce((a, b) => `cmul(${a}, ${b})`);
      }
      case "Divide":
        if (args.length !== 2) break;
        return `cdiv(${sub(0)}, ${sub(1)})`;
      case "Power": {
        if (args.length !== 2) break;
        // A small non-negative integer exponent becomes repeated multiplication:
        // faster than cpow and, more importantly, free of its branch cut.
        const base = sub(0);
        const e = numberOf(args[1] as Json);
        if (e !== undefined && Number.isInteger(e) && e >= 0 && e <= 8) {
          this.shapeParts.push(`^${e}`); // the exponent is baked in, not a slot
          if (e === 0) return this.slot(1, 0);
          let acc = base;
          for (let k = 1; k < e; k++) acc = `cmul(${acc}, ${base})`;
          return acc;
        }
        return `cpow(${base}, ${sub(1)})`;
      }
      case "Root": {
        if (args.length !== 2) break;
        return `cpow(${sub(0)}, cdiv(vec2f(1.0, 0.0), ${sub(1)}))`;
      }
      case "Square": {
        if (args.length !== 1) break;
        const v = sub(0);
        return `cmul(${v}, ${v})`;
      }
      case "Zeta":
        // One-argument Riemann zeta is ζ(s, 1); two-argument is the generalized one.
        if (args.length === 1) return `hurwitz(${sub(0)}, vec2f(1.0, 0.0))`;
        if (args.length === 2) return `zetaGen(${sub(0)}, ${sub(1)})`;
        break;
      default: {
        const kernel = KERNELS[head];
        if (kernel && args.length === kernel.arity) {
          return `${kernel.fn}(${args.map((_, i) => sub(i)).join(", ")})`;
        }
        const unary = UNARY[head] ?? UNARY[capitalize(head)];
        if (unary && args.length === 1) return `${unary}(${sub(0)})`;
      }
    }
    throw new Error(`unsupported ${head}/${args.length}`);
  }
}

/**
 * Compile `json` to a complex-valued WGSL expression over `variable`, or `undefined`
 * if it uses anything the emitter has no complex lowering for (an unbound symbol, an
 * unsupported head, too many literals) — callers fall back to the CPU sampler.
 */
export function emitComplexWGSL(json: Json, variable = "z"): ComplexWGSL | undefined {
  const emitter = new Emitter(variable);
  try {
    const code = emitter.emit(json);
    return {
      code,
      literals: emitter.literals.map(([a, b]) => [a, b] as const),
      shape: emitter.shape(),
    };
  } catch {
    return undefined;
  }
}
