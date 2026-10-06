// Third-party code the browser loads as precompiled files, not rebundled into every build.
//
// compute-engine and MathLive publish minified ES modules (KaTeX's is minified as it is copied);
// bundling them again costs build time for no gain. The client and worker builds leave their imports as `/vendor/<name>@<version>/…`
// URLs and copy the published files there, so a URL names its bytes forever and can be cached
// immutably (`public/_headers`). The SSR build imports them from node_modules as before.
//
// SITE_BUNDLE_VENDOR=1 bundles (and tree-shakes) them as any other module instead.
//
// An absolute URL in the bundle needs no import map, which a module worker ignores.
// The files keep their own relative imports (compute-engine's shared chunks), so one URL is one
// instance however many of our chunks import it.

import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { minifySync } from "vite";

const here = dirname(fileURLToPath(import.meta.url));

interface VendorPackage {
  readonly name: string;
  /** Where `name` resolves from: its install is the one the SSR build reads. */
  readonly from: string;
  /** The package ships its ES module unminified: it is minified as it is copied. */
  readonly minify?: boolean;
  /** The package's `exports` target for the browser, per subpath. */
  entry(exports: Record<string, unknown>, subpath: string): string | undefined;
}

const esm = (target: unknown): string | undefined =>
  typeof target === "string" ? target : (target as { import?: string } | undefined)?.import;

const PACKAGES: readonly VendorPackage[] = [
  { name: "@cortex-js/compute-engine", from: here, entry: (exports, sub) => esm(exports[sub]) },
  {
    name: "katex",
    from: resolve(here, "../../packages/components"),
    minify: true,
    entry: (exports, sub) => (exports[sub] as { import?: { default?: string } } | undefined)?.import?.default,
  },
  {
    name: "mathlive",
    from: resolve(here, "../../packages/components"),
    // The production browser build, minified.
    entry: (exports, sub) =>
      sub === "." ? esm((exports["."] as { browser: { production: unknown } }).browser.production) : undefined,
  },
];

interface Installed {
  readonly pkg: VendorPackage;
  readonly dir: string;
  readonly version: string;
  readonly exports: Record<string, unknown>;
}

const installs = new Map<string, Installed>();

function installed(pkg: VendorPackage): Installed {
  let found = installs.get(pkg.name);
  if (found) return found;
  // The package's directory is found from its main file; `package.json` may not be exported.
  let dir = dirname(createRequire(resolve(pkg.from, "package.json")).resolve(pkg.name));
  while (
    !existsSync(resolve(dir, "package.json")) ||
    JSON.parse(readFileSync(resolve(dir, "package.json"), "utf8")).name !== pkg.name
  )
    dir = dirname(dir);
  const manifest = JSON.parse(readFileSync(resolve(dir, "package.json"), "utf8")) as {
    version: string;
    exports: Record<string, unknown>;
  };
  found = { pkg, dir, version: manifest.version, exports: manifest.exports };
  installs.set(pkg.name, found);
  return found;
}

/** The files this build's bundles import, by URL: copied into the output by `writeVendor`. */
const used = new Map<string, { file: string; minify: boolean }>();

const bundled = process.env.SITE_BUNDLE_VENDOR === "1";

function vendorUrl(specifier: string, base: string): string | undefined {
  if (bundled) return undefined;
  const pkg = PACKAGES.find((p) => specifier === p.name || specifier.startsWith(`${p.name}/`));
  if (!pkg) return undefined;
  const install = installed(pkg);
  const subpath = specifier === pkg.name ? "." : `.${specifier.slice(pkg.name.length)}`;
  const target = pkg.entry(install.exports, subpath);
  // A subpath with no ES module (a stylesheet, say) is left to the bundler.
  if (target === undefined || !/\.m?js$/.test(target)) return undefined;
  const file = resolve(install.dir, target);
  const url = `${base}vendor/${pkg.name.replace(/^@/, "").replace("/", "-")}@${install.version}/${target.replace(/^\.\//, "")}`;
  used.set(url, { file, minify: pkg.minify === true });
  return url;
}

let siteBase = "/";

/** The URL `specifier` loads from, for a page that fetches it early. */
export function vendorHref(specifier: string): string | undefined {
  return vendorUrl(specifier, siteBase);
}

/**
 * Leave vendor imports as URLs in the client and worker bundles. `apply: "build"`: the dev server
 * serves them from node_modules.
 */
export function vendorExternals(base = "/") {
  siteBase = base;
  return {
    name: "enumeratio-vendor-externals",
    apply: "build" as const,
    enforce: "pre" as const,
    resolveId(
      this: { environment?: { name?: string } },
      source: string,
      _importer: string | undefined,
      options?: { ssr?: boolean },
    ) {
      if (options?.ssr || this.environment?.name === "ssr") return undefined;
      const url = vendorUrl(source, base);
      // "absolute": the URL is not a file path, so it is not made relative to the chunk.
      return url === undefined ? undefined : { id: url, external: "absolute" as const };
    },
  };
}

const RELATIVE_IMPORT = /(?:from|import)\s*\(?\s*["'](\.\/[^"']+\.m?js)["']/g;

/** `file` and the files it imports by relative path, transitively. */
function closure(file: string, seen = new Set<string>()): Set<string> {
  if (seen.has(file)) return seen;
  seen.add(file);
  for (const [, next] of readFileSync(file, "utf8").matchAll(RELATIVE_IMPORT))
    closure(resolve(dirname(file), next!), seen);
  return seen;
}

/** Copy the vendor files the bundles import (and what those import) under `outDir/vendor/`. */
export function writeVendor(outDir: string): string[] {
  const urls: string[] = [];
  for (const [url, { file: entry, minify }] of used) {
    const root = dirname(entry);
    const rootUrl = dirname(url);
    for (const file of closure(entry)) {
      const rel = file.slice(root.length + 1);
      const destination = resolve(outDir, `.${rootUrl}/${rel}`);
      mkdirSync(dirname(destination), { recursive: true });
      if (minify) writeFileSync(destination, minifySync(file, readFileSync(file, "utf8"), { module: true }).code);
      else copyFileSync(file, destination);
      urls.push(`${rootUrl}/${rel}`);
    }
  }
  return [...new Set(urls)].toSorted();
}

/** The bytes `writeVendor` ships, for the build's log. */
export function vendorBytes(outDir: string, urls: readonly string[]): number {
  return urls.reduce((sum, url) => sum + statSync(resolve(outDir, `.${url}`)).size, 0);
}
