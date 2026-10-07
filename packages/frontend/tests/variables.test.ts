import { describe, expect, it } from "vite-plus/test";
import { fillTex, variablesOf, randomInteger, stepInteger } from "../src/variables.ts";

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
