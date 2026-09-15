import { expect, test } from "vite-plus/test";
import { handleRequest } from "../src/index.ts";

const q = (s = "") => s;
// biome-ignore lint/suspicious/noExplicitAny: reading loosely-typed JSON replies
const json = (r: { json: unknown }) => r.json as any;

test("POST /eval evaluates (Epsil default) and returns a few forms", () => {
  const r = handleRequest("POST", "/eval", q(), { input: "Binomial(10, 3)" });
  expect(r.status).toBe(200);
  expect(json(r).ok).toBe(true);
  expect(json(r).result).toBe("120");
  expect(json(r).forms.wolfram).toBe("120");
});

test("/eval honours syntax and form", () => {
  const r = handleRequest("POST", "/eval", q(), {
    input: "Binomial[10, 3]",
    syntax: "wolfram",
    form: "wolfram",
  });
  expect(json(r).result).toBe("120");
});

test("/eval rejects a missing input or unknown form", () => {
  expect(handleRequest("POST", "/eval", q(), {}).status).toBe(400);
  expect(handleRequest("POST", "/eval", q(), { input: "x", form: "nope" }).status).toBe(400);
});

test("an evaluation error is ok:false, not a crash", () => {
  const r = handleRequest("POST", "/eval", q(), { input: ":wl 1 +" });
  expect(r.status).toBe(200);
  expect(json(r).ok).toBe(false);
  expect(json(r).error).toMatch(/./);
});

test("GET /formats and /mime introspect the registry", () => {
  expect(
    json(handleRequest("GET", "/formats", q(), {})).formats.some(
      (f: { name: string }) => f.name === "WL",
    ),
  ).toBe(true);
});

test("/mime keeps `+` and `/` literal (and still accepts %2B/%2F)", () => {
  expect(json(handleRequest("GET", "/mime", "type=image/svg+xml", {})).formats).toContain("SVG");
  expect(json(handleRequest("GET", "/mime", "type=image%2Fsvg%2Bxml", {})).formats).toContain(
    "SVG",
  );
});

test("/eval resolves partial form and syntax names", () => {
  expect(json(handleRequest("POST", "/eval", q(), { input: "x^2", form: "wolf" })).result).toBe(
    "Power[x, 2]",
  );
  expect(
    json(handleRequest("POST", "/eval", q(), { input: "Binomial[10,3]", syntax: "wolf" })).result,
  ).toBe("120");
});

test("unknown routes 404", () => {
  expect(handleRequest("GET", "/nope", q(), {}).status).toBe(404);
});
