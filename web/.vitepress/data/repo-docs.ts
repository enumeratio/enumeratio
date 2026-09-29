// Markdown that lives outside web/ — each package's README — served through a dynamic route
// (`/packages/<name>`). The files stay where they are; links are rewritten here so the same
// markdown reads right on GitHub and on the site. Design docs and the roadmap live on the
// wiki (https://github.com/enumeratio/enumeratio/wiki) now, not under a repo-relative route.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, posix, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(here, "../../..");
const githubBlob = "https://github.com/enumeratio/enumeratio/blob/main/";

export interface WorkspacePackage {
  /** `@enumeratio/…` */
  name: string;
  /** The route slug: the name without its scope. */
  slug: string;
  description?: string;
  /** Repo-relative directory. */
  dir: string;
  /** Sibling packages this one depends on at runtime / only in development. */
  deps: string[];
  devDeps: string[];
  readme?: string;
}

// The workspace globs, less web/ itself.
const packageGlobs = ["packages/*", "packages/symbols/*/*", "tools/*", "upstream/*"];

function expand(glob: string): string[] {
  let dirs = [""];
  for (const part of glob.split("/")) {
    dirs = dirs.flatMap((dir) =>
      part === "*"
        ? readdirSync(join(repoRoot, dir), { withFileTypes: true })
            .filter((e) => e.isDirectory() && e.name !== "node_modules")
            .map((e) => posix.join(dir, e.name))
        : [posix.join(dir, part)],
    );
  }
  return dirs;
}

export function workspacePackages(): WorkspacePackage[] {
  const found: WorkspacePackage[] = [];
  for (const dir of packageGlobs.flatMap(expand)) {
    const manifest = join(repoRoot, dir, "package.json");
    if (!existsSync(manifest)) continue;
    const pkg = JSON.parse(readFileSync(manifest, "utf8")) as {
      name?: string;
      description?: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    if (!pkg.name?.startsWith("@enumeratio/")) continue;
    const siblings = (deps = {}) => Object.keys(deps).filter((d) => d.startsWith("@enumeratio/"));
    const deps = siblings(pkg.dependencies);
    const readme = join(repoRoot, dir, "README.md");
    found.push({
      name: pkg.name,
      slug: pkg.name.slice("@enumeratio/".length),
      description: pkg.description,
      dir,
      deps,
      devDeps: siblings(pkg.devDependencies).filter((d) => !deps.includes(d)),
      readme: existsSync(readme) ? readme : undefined,
    });
  }
  return found.toSorted((a, b) => a.slug.localeCompare(b.slug));
}

/** Where a repo-relative path is served on the site, if it is. */
function siteRoute(path: string, readmes: Map<string, string>): string | undefined {
  return readmes.get(path) ?? readmes.get(path.replace(/\/$/, ""));
}

let readmeRoutes: Map<string, string> | undefined;

/**
 * Point a file's relative links where the site serves them, or at GitHub when it does not.
 * Absolute and external links, and anchors, are left alone.
 */
export function rewriteLinks(markdown: string, file: string): string {
  readmeRoutes ??= new Map(
    workspacePackages().flatMap((p) => [
      [`${p.dir}/README.md`, `/packages/${p.slug}`],
      [p.dir, `/packages/${p.slug}`],
    ]),
  );
  const from = posix.dirname(relative(repoRoot, file).split("\\").join("/"));
  return markdown.replace(
    /(\]\()([^)\s#]+)(#[^)\s]*)?(\s+"[^"]*")?\)/g,
    (whole, open, target: string, hash = "", title = "") => {
      if (/^([a-z]+:|\/|#)/i.test(target)) return whole;
      const path = posix.normalize(posix.join(from, target));
      const route = siteRoute(path, readmeRoutes!);
      return `${open}${route ? route + hash : githubBlob + path + hash}${title})`;
    },
  );
}

/** The package page: its README, or its description when it has none, then its edges. */
export function packagePage(pkg: WorkspacePackage): string {
  const body = pkg.readme
    ? rewriteLinks(readFileSync(pkg.readme, "utf8"), pkg.readme)
    : `# ${pkg.name}\n\n${pkg.description ?? ""}\n`;
  const link = (name: string) =>
    `[\`${name.slice("@enumeratio/".length)}\`](/packages/${name.slice("@enumeratio/".length)})`;
  const facts = [
    `- Source: [\`${pkg.dir}\`](${githubBlob.replace("/blob/", "/tree/")}${pkg.dir})`,
    pkg.deps.length ? `- Depends on: ${pkg.deps.map(link).join(", ")}` : "",
    pkg.devDeps.length ? `- In development, also: ${pkg.devDeps.map(link).join(", ")}` : "",
  ].filter(Boolean);
  return `${body.trimEnd()}\n\n---\n\n${facts.join("\n")}\n`;
}
