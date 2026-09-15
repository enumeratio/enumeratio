// The Node-side config file: session defaults (`form`, `syntax`, `precision`)
// the bin applies under any flags. Looked up at $NOTATIO_CONFIG, then
// ~/.config/notatio/config.json, then ~/.notatiorc — the first that exists wins.
// A missing file is the empty config; a malformed one is an error the bin reports.

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { FORMS, resolveForm, resolveSyntax, type SessionDefaults, SYNTAXES } from "./engine.ts";

export interface ConfigFile {
  form?: string;
  syntax?: string;
  precision?: number;
}

/** Candidate config paths, most specific first. */
export function configPaths(env: NodeJS.ProcessEnv = process.env): string[] {
  const home = env.HOME || homedir();
  const xdg = env.XDG_CONFIG_HOME || join(home, ".config");
  return [env.NOTATIO_CONFIG, join(xdg, "notatio", "config.json"), join(home, ".notatiorc")].filter(
    (p): p is string => Boolean(p),
  );
}

/** Validate a parsed config object into session defaults. Throws on a bad value. */
export function parseConfig(raw: unknown, where = "config"): SessionDefaults {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw))
    throw new Error(`${where}: expected a JSON object`);
  const cfg = raw as ConfigFile;
  const out: SessionDefaults = {};
  if (cfg.form !== undefined) {
    const form = typeof cfg.form === "string" ? resolveForm(cfg.form) : undefined;
    if (!form)
      throw new Error(`${where}: unknown form ${JSON.stringify(cfg.form)} (${FORMS.join(", ")})`);
    out.form = form;
  }
  if (cfg.syntax !== undefined) {
    const syntax = typeof cfg.syntax === "string" ? resolveSyntax(cfg.syntax) : undefined;
    if (!syntax)
      throw new Error(
        `${where}: unknown syntax ${JSON.stringify(cfg.syntax)} (${SYNTAXES.join(", ")})`,
      );
    out.syntax = syntax;
  }
  if (cfg.precision !== undefined) {
    if (!Number.isInteger(cfg.precision) || (cfg.precision as number) < 1)
      throw new Error(`${where}: precision must be a positive integer`);
    out.precision = cfg.precision;
  }
  return out;
}

/** Load the first config file found (or `{}`); a malformed file throws. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): SessionDefaults {
  const path = configPaths(env).find((p) => existsSync(p));
  if (!path) return {};
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    throw new Error(`${path}: ${(err as Error).message}`);
  }
  return parseConfig(raw, path);
}
