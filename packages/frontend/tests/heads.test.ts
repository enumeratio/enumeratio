import { expect, test } from "vite-plus/test";
import { formOfHead, splitHead, stripHead, WRAPPER_HEADS, wrapHead } from "../src/heads.ts";

test("wrapHead spells the head for the source's form", () => {
  expect(wrapHead("\\frac{1}{2}+\\frac{1}{3}", "N")).toEqual("\\operatorname{N}(\\frac{1}{2}+\\frac{1}{3})");
  expect(wrapHead("x^2 + 1", "FullForm", "epsil")).toEqual("FullForm(x^2 + 1)");
  // A `$…$` island only occurs in Epsil, so the bare head is the right spelling.
  expect(wrapHead("$x^2$ + 1", "N")).toEqual("N($x^2$ + 1)");
});

test("wrapHead replaces rather than nests, and is empty-safe", () => {
  const once = wrapHead("\\sqrt{2}", "N");
  expect(wrapHead(once, "N")).toEqual(once);
  expect(wrapHead(once, "TraditionalForm")).toEqual("\\operatorname{TraditionalForm}(\\sqrt{2})");
  expect(wrapHead("", "N")).toEqual("");
  expect(wrapHead("   ", "N")).toEqual("");
  expect(wrapHead("\\pi", "Nope")).toEqual("\\pi"); // not a head we offer
});

test("splitHead reads one head off, whatever its spelling", () => {
  expect(splitHead("\\operatorname{N}(\\sqrt{2})")).toEqual({ head: "N", body: "\\sqrt{2}" });
  expect(splitHead("\\mathrm{FullForm}(x)")).toEqual({ head: "FullForm", body: "x" });
  expect(splitHead("TreeForm($x^2$)")).toEqual({ head: "TreeForm", body: "$x^2$" });
  expect(splitHead("\\operatorname{N}\\left(\\frac{1}{2}\\right)")).toEqual({
    head: "N",
    body: "\\frac{1}{2}",
  });
  expect(splitHead("\\pi")).toEqual({ head: "", body: "\\pi" });
  expect(splitHead("")).toEqual({ head: "", body: "" });
  expect(stripHead(stripHead("\\operatorname{N}(\\pi)"))).toEqual("\\pi");
});

test("only a head around the whole source counts", () => {
  expect(splitHead("\\operatorname{N}(x) + 1").head).toEqual("");
  expect(stripHead("\\operatorname{N}(x) + 1")).toEqual("\\operatorname{N}(x) + 1");
  expect(splitHead("\\operatorname{Norm}(x)").head).toEqual("");
  expect(splitHead("Norm(x)").head).toEqual("");
  expect(splitHead("\\operatorname{N}(f(x) + g(y))")).toEqual({ head: "N", body: "f(x) + g(y)" });
});

test("a head either asks for a form or belongs to the expression", () => {
  // `N` is compute-engine's own head: no form, so it stays in what the engine sees.
  expect(formOfHead("N")).toEqual(undefined);
  expect(formOfHead("TraditionalForm")).toEqual("traditional");
  expect(formOfHead("FullForm")).toEqual("full");
  expect(formOfHead("nonsense")).toEqual(undefined);
  expect(WRAPPER_HEADS.map((h) => h.head)).toEqual([
    "N",
    "TraditionalForm",
    "InputForm",
    "FullForm",
    "TreeForm",
    "TeXForm",
  ]);
});
