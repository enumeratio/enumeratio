import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareAnalytic } from "@enumeratio/analytic/src";
import { expect, test } from "vite-plus/test";
import { collectErrors } from "../src/assert.ts";
import {
  boundName,
  type Cell,
  bindingSource,
  controlsFor,
  freeVariables,
  inferProjection,
  missingProjection,
  projectionReason,
  DEFAULT_BOUND,
  inferRange,
  resolveRange,
  projectionFits,
  referencesOrdinal,
  runPass,
  symbolLatex,
} from "../src/reactive.ts";

const ce = new ComputeEngine();
declareAnalytic(ce);

const cell = (value: string, id = 1): Cell => ({ id, value });

const pass = (...sources: string[]) =>
  runPass(
    ce,
    sources.map((s, i) => cell(s, i + 1)),
    { rejectOrdinals: true, markup: (l) => l, errors: collectErrors },
  );

// --- the reactive pass ---------------------------------------------------------------

test("a binding is visible to later cells by name", () => {
  const [, second] = pass("a \\coloneq 5", "a + 1");
  expect(second.value?.re).toBe(6);
});

test("the scope is rebuilt each pass, so a removed binding really is gone", () => {
  pass("a \\coloneq 5", "a + 1");
  const [only] = pass("a + 1"); // `a` was never bound in *this* pass
  expect(only.value?.re).not.toBe(6);
});

test("a workworksheet's bindings do not leak to the next pass or to other elements", () => {
  pass("leaked \\coloneq 42");
  expect(ce.box("leaked").evaluate().re).not.toBe(42);
});

test("a binding does not write through to a symbol the page already mentions", () => {
  // Pushing a scope is not enough on its own. Another element merely *mentioning* a
  // symbol declares it on the shared root, and an assignment then writes through to
  // that outer binding -- so two worksheets using `x`, or a worksheet and the reference
  // pages, would silently share variables.
  const engine = new ComputeEngine();
  engine.box(["Add", "shared", 1]).unknowns; // some other element on the page
  const cells = [
    { id: 1, value: "shared \\coloneq 2" },
    { id: 2, value: "shared + 1" },
  ];
  const out = runPass(engine, cells, {
    rejectOrdinals: true,
    markup: (l) => l,
    errors: collectErrors,
  });
  expect(out[1].value?.re).toBe(3); // the worksheet sees its own binding
  expect(engine.box("shared").evaluate().re).not.toBe(2); // the page's is untouched
});

test("a failing cell reports rather than aborting the pass", () => {
  const cells = pass("a \\coloneq 5", "\\frac{", "a + 2");
  expect(cells[1].result.status).toBe("error");
  expect(cells[2].value?.re).toBe(7); // later cells still ran
});

test("blank cells are skipped entirely", () => {
  expect(pass("", "  ", "a \\coloneq 1")).toHaveLength(1);
});

test("cell-number references are rejected where cells can be reordered", () => {
  const [only] = pass("@_1 + 1");
  expect(only.result.status).toBe("invalid");
  expect(only.result.detail).toContain(":=");
});

test("referencesOrdinal catches both spellings", () => {
  expect(referencesOrdinal("@_1 + 1", null)).toBe(true);
  expect(referencesOrdinal("@_{12}", null)).toBe(true);
  expect(referencesOrdinal("x + 1", ["At", "Out", 2])).toBe(true);
  expect(referencesOrdinal("x + 1", ["Add", "x", 1])).toBe(false);
});

test("boundName picks out the assigned symbol", () => {
  expect(boundName(["Assign", "a", 5])).toBe("a");
  expect(boundName(["Add", "a", 5])).toBeUndefined();
});

// --- controls -------------------------------------------------------------------------

test("a plain numeric binding becomes one control", () => {
  const [only] = pass("s \\coloneq 2");
  const [c] = controlsFor(only.result.name, only.value!);
  expect(c.name).toBe("s");
  expect(c.part).toBe("real");
  expect(c.value).toBe(2);
  expect(c.min).toBeLessThanOrEqual(2);
  expect(c.max).toBeGreaterThanOrEqual(2);
});

test("a complex binding becomes two, one per part", () => {
  const [only] = pass("w \\coloneq 2 + 3i");
  const cs = controlsFor(only.result.name, only.value!);
  expect(cs.map((c) => c.part)).toEqual(["re", "im"]);
  expect(cs[0].value).toBe(2);
  expect(cs[1].value).toBe(3);
  // Each carries the other part, so moving one can preserve it.
  expect(cs[0].other).toBe(3);
  expect(cs[1].other).toBe(2);
});

test("moving one part of a complex binding keeps the other", () => {
  const [only] = pass("w \\coloneq 2 + 3i");
  const [re, im] = controlsFor(only.result.name, only.value!);
  expect(bindingSource(re, 5)).toBe("w\\coloneq 5 + 3i");
  expect(bindingSource(im, -4)).toBe("w\\coloneq 2 - 4i");
});

test("a rewritten binding round-trips, and carries no float noise", () => {
  const [only] = pass("s \\coloneq 2");
  const [c] = controlsFor(only.result.name, only.value!);
  const src = bindingSource(c, 0.1 + 0.2); // 0.30000000000000004
  expect(src).toBe("s\\coloneq 0.3");
  const [back] = pass(src);
  expect(back.value?.re).toBeCloseTo(0.3, 12);
});

test("a complex rewrite round-trips through the parser", () => {
  const [only] = pass("w \\coloneq 2 + 3i");
  const [re] = controlsFor(only.result.name, only.value!);
  const [back] = pass(bindingSource(re, -1.5));
  expect(back.value?.re).toBeCloseTo(-1.5, 12);
  expect(back.value?.im).toBeCloseTo(3, 12);
});

test("a non-numeric or unbound cell contributes no control", () => {
  const [expr] = pass("2 + 3");
  expect(controlsFor(expr.result.name, expr.value!)).toEqual([]); // binds nothing
  const [fn] = pass("f(x) \\coloneq x^2");
  expect(controlsFor(fn.result.name, fn.value!)).toEqual([]); // nor is a function
  const [sym] = pass("u \\coloneq v + 1");
  expect(controlsFor(sym.result.name, sym.value!)).toEqual([]); // nor a symbolic value
});

test("a knob's range is symmetric and the same for every ordinary value", () => {
  // The previous rule scaled through powers of ten, so 2 got [0, 10] while 8 got
  // [0, 100] and 0.5 got [0, 1] -- neighbouring values landing on wildly different
  // sensitivities, which is what made a slider run away the moment you touched it.
  for (const v of [0, 0.5, 2, 3, 8, 10, -3, -10]) {
    expect(inferRange(v)).toEqual({ min: -DEFAULT_BOUND, max: DEFAULT_BOUND, step: 0.05 });
  }
});

test("a value outside the default range widens it just enough to hold it", () => {
  for (const v of [42, -250, 1000]) {
    const r = inferRange(v);
    expect(r.min).toBeLessThanOrEqual(v);
    expect(r.max).toBeGreaterThanOrEqual(v);
    expect(r.min).toBe(-r.max); // still symmetric
    expect(r.step).toBeGreaterThan(0);
    expect(r.step).toBeLessThan(r.max - r.min);
  }
});

test("an edited endpoint overrides the default, and the rest is kept", () => {
  expect(resolveRange(2, { min: 0 })).toEqual({ min: 0, max: 10, step: 0.05 });
  expect(resolveRange(2, { max: 1 })).toEqual({ min: -10, max: 1, step: 0.05 });
  expect(resolveRange(2, { min: 0, max: 1, step: 0.01 })).toEqual({
    min: 0,
    max: 1,
    step: 0.01,
  });
});

test("the step follows an edited range unless it is pinned too", () => {
  expect(resolveRange(2, { min: 0, max: 1 }).step).toBeLessThan(0.05);
  expect(resolveRange(2, { min: -1000, max: 1000 }).step).toBeGreaterThan(0.05);
});

test("a range that would leave the slider stuck falls back to the default", () => {
  expect(resolveRange(2, { min: 5, max: 5 })).toEqual(inferRange(2));
  expect(resolveRange(2, { min: Number.NaN })).toEqual(inferRange(2));
  // Given backwards, it is read as the range it obviously means.
  expect(resolveRange(2, { min: 4, max: -4 })).toEqual({ min: -4, max: 4, step: 0.02 });
});

test("no override is the inferred range", () => {
  expect(resolveRange(3, undefined)).toEqual(inferRange(3));
  expect(resolveRange(3, {})).toEqual(inferRange(3));
});

// --- projection ------------------------------------------------------------------------

test("free variables decide the default projection", () => {
  expect(inferProjection(["z"])).toBe("portrait");
  expect(inferProjection(["x"])).toBe("curve");
  expect(inferProjection(["x", "y"])).toBe("surface");
  expect(inferProjection([])).toBe("none"); // a binding cell draws nothing
  expect(inferProjection(["t"])).toBe("none"); // an unrecognised axis
  expect(inferProjection(["x", "z"])).toBe("none"); // mixed axes are ambiguous
});

test("a bound name is not free, so a cell over a slider still plots", () => {
  // A fresh engine: boxing `s` anywhere declares it, which would take it out of
  // `unknowns` and quietly change what this measures.
  const engine = new ComputeEngine();
  declareAnalytic(engine);
  const expr = engine.box(["PolyLog", "s", "z"]);
  expect(freeVariables(expr, new Set(["s"]))).toEqual(["z"]);
  expect(inferProjection(freeVariables(expr, new Set(["s"])))).toBe("portrait");
  // With `s` unbound the cell is over two unknowns and draws nothing by default.
  expect(inferProjection(freeVariables(expr, new Set()))).toBe("none");
});

test("an explicit projection is checked against the variables actually free", () => {
  expect(projectionFits("portrait", ["z"])).toBe(true);
  expect(projectionFits("surface", ["x", "y"])).toBe(true);
  expect(projectionFits("curve", ["x"])).toBe(true);
  expect(projectionFits("none", ["anything"])).toBe(true);
  // The override cannot conjure an axis the cell does not have.
  expect(projectionFits("surface", ["x"])).toBe(false);
  expect(projectionFits("portrait", ["x"])).toBe(false);
});

// --- a rewritten binding has to parse back to the same symbol ------------------------

test("symbolLatex round-trips every spelling a binding can have", () => {
  // Writing the internal name straight back destroys the binding: `extent_sansserif`
  // is not `\mathsf{extent}`, and a bare `camera` parses as six letters multiplied.
  for (const source of ["s", "\\mathrm{camera}", "\\mathsf{extent}", "\\mathtt{mode}"]) {
    const symbol = ce.parse(source).json as string;
    expect(typeof symbol).toBe("string");
    expect(ce.parse(symbolLatex(symbol)).json).toBe(symbol);
  }
});

test("a multi-letter binding survives its slider moving", () => {
  const [only] = pass("\\mathrm{camera} \\coloneq 2");
  const [c] = controlsFor(only.result.name, only.value!);
  const [back] = pass(bindingSource(c, 5));
  expect(back.result.name).toBe("camera");
  expect(back.value?.re).toBe(5);
});

test("a setting binding survives its slider moving", () => {
  const [only] = pass("\\mathsf{extent} \\coloneq 1.2");
  const [c] = controlsFor(only.result.name, only.value!);
  expect(c.name).toBe("extent_sansserif");
  const [back] = pass(bindingSource(c, 6));
  expect(back.result.name).toBe("extent_sansserif"); // still a setting, not a new name
  expect(back.value?.re).toBe(6);
});

// --- declining to draw ----------------------------------------------------------------

test("a projection that cannot be drawn declines with Missing", () => {
  // Not silence: an unevaluated expression looks exactly like one nobody reached yet,
  // which is how a pane came to draw nothing without anybody noticing.
  expect(missingProjection(ce).json).toBe("Missing");
});

test("the reason says what would have had to be true instead", () => {
  expect(projectionReason("surface", ["x"])).toContain("x, y");
  expect(projectionReason("curve", ["t"])).toContain("t");
  expect(projectionReason("portrait", [])).toContain("nothing");
  expect(projectionReason("none", ["x"])).toContain("nothing here");
});

// --- pinned declarations -------------------------------------------------------------

const typedPass = (cells: Cell[]) =>
  runPass(ce, cells, { rejectOrdinals: true, markup: (l) => l, errors: collectErrors });

test("a cell declared integer rejects a value outside the type", () => {
  const [p] = typedPass([{ id: 1, value: "p \\coloneq 2.5", bind: "p", domain: "integer" }]);
  expect(p?.result.status).toBe("error");
  expect(p?.result.detail).toContain("expected integer");
});

test("a cell declared integer accepts a whole number", () => {
  const [p, q] = typedPass([
    { id: 1, value: "p \\coloneq 3", bind: "p", domain: "integer" },
    { id: 2, value: "p + 1" },
  ]);
  expect(p?.result.status).toBe("");
  expect(q?.value?.re).toBe(4);
});

test("an undeclared cell still takes any value", () => {
  const [a] = typedPass([{ id: 1, value: "a \\coloneq 2.5" }]);
  expect(a?.result.status).toBe("");
  expect(a?.value?.re).toBe(2.5);
});

test("a declared name keeps its type while the cell is mid-edit", () => {
  // The binding is unparseable, so nothing assigns -- but `p` must not fall back to
  // an untyped declaration, or the next keystroke would be checked against nothing.
  const [, q] = typedPass([
    { id: 1, value: "p \\coloneq ", bind: "p", domain: "integer" },
    { id: 2, value: "p \\coloneq 1.5", bind: "p", domain: "integer" },
  ]);
  expect(q?.result.detail).toContain("expected integer");
});
