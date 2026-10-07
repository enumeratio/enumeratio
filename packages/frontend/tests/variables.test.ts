import { describe, expect, it } from "vite-plus/test";
import {
  fillTex,
  pointWords,
  randomInteger,
  randomValue,
  registerDomain,
  resolveNamedDomains,
  stepInteger,
  variablesOf,
} from "../src/variables.ts";

const kv = (k: string, v: unknown) => ["KeyValuePair", k, v];

describe("variables", () => {
  it("read a start, a domain, choices, or a Variable", () => {
    const [d, h, s, r, t] = variablesOf([
      "List",
      kv("_d", [
        "Variable",
        "Integers",
        ["Negate", 5],
        kv("Where", ["And", "IsSquareFree", ["Not", "IsSquare"]]),
        kv("Range", ["List", -400, 400]),
      ]),
      kv("_h", ["List", ["Labeled", "Associates", "'associates'"], "Multiples"]),
      kv("_s", ["List"]),
      kv("_r", 0.5),
      kv("_t", ["Variable", "Automatic", ["List", ["Tuple", 6, 0]]]),
    ]);
    expect(d!.start).toEqual(["Negate", 5]);
    expect(d!.domain.kind === "integers" && [d!.domain.min, d!.domain.max]).toEqual([-400, 400]);
    expect(h).toMatchObject({ name: "h", start: "Associates", domain: { labels: ["associates", "Multiples"] } });
    expect(s).toMatchObject({ name: "s", domain: { kind: "any" } });
    expect(r!.domain.kind).toBe("reals");
    expect(t).toMatchObject({ domain: { kind: "any" }, start: ["List", ["Tuple", 6, 0]] });
  });

  it("step and draw only integers the domain admits", () => {
    const [d] = variablesOf([
      "List",
      kv("_d", ["Variable", "Integers", kv("Where", ["And", "IsSquareFree", ["Not", "IsSquare"]])]),
    ]);
    const domain = d!.domain;
    if (domain.kind !== "integers") throw new Error("integers");
    expect(stepInteger(domain, -1, 1)).toBe(2);
    expect(stepInteger(domain, 3, 1)).toBe(5);
    expect(stepInteger(domain, 2, -1)).toBe(-1);
    for (let k = 0; k < 20; k++) expect(domain.where!(randomInteger(domain, 2))).toBe(true);
  });
});

describe("TeX holes", () => {
  it("fill `_d` and `_{name}` standing alone, never a subscript on something", () => {
    const values = new Map([
      ["d", "-5"],
      ["name", "x"],
    ]);
    expect(fillTex("\\mathbb{Q}(\\sqrt{_d})", values)).toBe("\\mathbb{Q}(\\sqrt{{-5}})");
    expect(fillTex("_{name} + a_d", values)).toBe("{x} + a_d");
    expect(fillTex("_q", values)).toBe("_q");
  });
});

describe("ring points and named domains", () => {
  it("write a ring's lattice points as the ring does", () => {
    expect(pointWords("GaussianIntegers", ["Tuple", -1, 1])).toBe("−1 + i");
    expect(pointWords("EisensteinIntegers", ["Tuple", 2, -1])).toBe("2 − ω");
    expect(pointWords("GaussianIntegers", ["Tuple", 0, -2])).toBe("−2i");
    expect(pointWords("Somewhere", ["Tuple", 1, 2])).toBe("(1, 2)");
  });

  it("take a ring, or another variable's, as the domain of points", () => {
    const [b, c] = variablesOf([
      "List",
      kv("_b", ["Variable", "_r", ["Tuple", -1, 1]]),
      kv("_c", ["Variable", "GaussianIntegers", ["List", ["Tuple", 1, 0]]]),
    ]);
    expect(b!.domain).toEqual({ kind: "points", ring: "_r" });
    expect(b!.start).toEqual(["Tuple", -1, 1]);
    expect(c!.domain).toEqual({ kind: "points", ring: "GaussianIntegers" });
  });

  it("resolve a named domain to the choices its library supplies", async () => {
    registerDomain("Examples", async () => [
      ["'a'", "the first"],
      ["'b'", "the second"],
    ]);
    const [e, f] = await resolveNamedDomains(
      variablesOf(["List", kv("_e", ["Variable", "Examples", "'b'"]), kv("_f", ["Variable", "Unheard", 1])]),
    );
    expect(e!.domain).toEqual({ kind: "choices", values: ["'a'", "'b'"], labels: ["the first", "the second"] });
    expect(e!.start).toBe("'b'");
    expect(f!.domain.kind).toBe("any");
  });
});

describe("random draws", () => {
  it("draw from any domain: choices, booleans, reals, ring points in their range", () => {
    const [h, k, x, b, ds] = variablesOf([
      "List",
      kv("_h", ["List", "A", "B", "C"]),
      kv("_k", "True"),
      kv("_x", ["Variable", "Reals", 0.5, kv("Range", ["List", 0, 1])]),
      kv("_b", ["Variable", "GaussianIntegers", ["Tuple", 0, 1], kv("Range", ["List", -2, 2])]),
      kv("_ds", ["Variable", "GaussianIntegers", ["List", ["Tuple", 1, 0]]]),
    ]);
    for (let n = 0; n < 20; n++) {
      expect(["B", "C"]).toContain(randomValue(h!, "A"));
      const r = randomValue(x!, 0.5) as number;
      expect(r >= 0 && r <= 1).toBe(true);
      const p = randomValue(b!, ["Tuple", 0, 1]) as number[];
      expect(p.slice(1).every((c) => c >= -2 && c <= 2)).toBe(true);
    }
    expect(randomValue(k!, "True")).toBe("False");
    expect(randomValue(ds!, ["List", ["Tuple", 1, 0]])).toBeUndefined();
  });
});
