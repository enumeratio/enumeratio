import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { configPaths, loadConfig, parseConfig } from "../src/index.ts";

const dir = mkdtempSync(join(tmpdir(), "notatio-config-"));
const file = (name: string, body: string) => {
  const p = join(dir, name);
  writeFileSync(p, body);
  return p;
};

test("parseConfig validates form / syntax / precision", () => {
  expect(parseConfig({ form: "TeXForm", syntax: "wl", precision: 12 })).toEqual({
    form: "tex",
    syntax: "wolfram",
    precision: 12,
  });
  expect(parseConfig({})).toEqual({});
  expect(() => parseConfig({ form: "nope" })).toThrow(/unknown form/);
  expect(() => parseConfig({ precision: 0 })).toThrow(/precision/);
  expect(() => parseConfig([])).toThrow(/object/);
});

test("$NOTATIO_CONFIG wins, then XDG, then ~/.notatiorc", () => {
  const env = {
    HOME: dir,
    XDG_CONFIG_HOME: join(dir, "xdg"),
    NOTATIO_CONFIG: join(dir, "explicit"),
  };
  expect(configPaths(env)).toEqual([
    join(dir, "explicit"),
    join(dir, "xdg", "notatio", "config.json"),
    join(dir, ".notatiorc"),
  ]);
});

test("loadConfig reads the first existing file; none is the empty config", () => {
  expect(loadConfig({ HOME: dir })).toEqual({});
  const rc = file(".notatiorc", '{"form":"wolfram"}');
  expect(loadConfig({ HOME: dir })).toEqual({ form: "wolfram" });
  const explicit = file("explicit.json", '{"precision":30}');
  expect(loadConfig({ HOME: dir, NOTATIO_CONFIG: explicit })).toEqual({ precision: 30 });
  expect(rc).toMatch(/notatiorc$/);
});

test("a malformed config names the file", () => {
  const bad = file("bad.json", "{not json");
  expect(() => loadConfig({ HOME: dir, NOTATIO_CONFIG: bad })).toThrow(/bad\.json/);
});
