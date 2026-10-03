// Package docs: markdown that lives in each package, served through one dynamic route
// (`/docs/<slug>/…`). A package's README.md is its landing page and `docs/**/*.md` its
// further pages. The files stay where they are; links are rewritten here so the same
// markdown reads right on GitHub and on the site. Design docs and the roadmap live on the
// wiki (https://github.com/enumeratio/enumeratio/wiki), not here.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, posix, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(here, "../../..");
const githubBlob = "https://github.com/enumeratio/enumeratio/blob/main/";
// Package docs link the site absolutely, so the link also works on GitHub; served here, the
// origin is dropped so it stays on whichever deployment is showing it.
const siteOrigin = "https://enumeratio.dev";

export interface DocPage {
  /** Repo-relative path of the markdown file. */
  file: string;
  /** The route below `/docs/<slug>/`, without `.md`: `torus-knots`, `guide/index`. */
  page: string;
  title: string;
  order: number;
}

export interface WorkspacePackage {
  /** `@enumeratio/…` */
  name: string;
  /** The route slug: the name without its scope. */
  slug: string;
  description?: string;
  /** Repo-relative directory. */
  dir: string;
  /** Where the package sits on /docs: see `groupOf`. */
  group: string;
  /** Sibling packages this one depends on at runtime / only in development. */
  deps: string[];
  devDeps: string[];
  readme?: string;
  /** Its `docs/**\/*.md`, in reading order. */
  pages: DocPage[];
}

// The workspace globs, less web/ itself. SITE_FROM_PACKAGES=1 reads the installed packages instead
// (`node_modules/@enumeratio/*`, beside web/), as a build from the registry would.
const packageGlobs =
  process.env.SITE_FROM_PACKAGES === "1"
    ? ["node_modules/@enumeratio/*"]
    : ["packages/*", "packages/symbols/*/*", "tools/*"];

/** The /docs groups, in page order. A symbol package names its own in `enumeratio.group`. */
export const groups = [
  "interface",
  "arithmetic",
  "combinatorics",
  "algebras",
  "groups",
  "analysis",
  "evaluation",
  "foundation",
  "tooling",
] as const;

const interfacePackages = new Set(["frontend", "components", "cli", "formats", "boxes", "raster"]);
const toolingPackages = new Set([
  "reference",
  "oracle",
  "bench",
  "catalog",
  "census",
  "utils",
  "perf-tools",
  "wolfram",
]);

function groupOf(slug: string, declared: string | undefined): string {
  if (declared) return declared;
  if (interfacePackages.has(slug)) return "interface";
  if (toolingPackages.has(slug)) return "tooling";
  return "foundation";
}

function expand(glob: string): string[] {
  let dirs = [""];
  for (const part of glob.split("/")) {
    dirs = dirs.flatMap((dir) =>
      part === "*"
        ? readdirSync(join(repoRoot, dir), { withFileTypes: true })
            .filter((e) => (e.isDirectory() || e.isSymbolicLink()) && e.name !== "node_modules")
            .map((e) => posix.join(dir, e.name))
        : [posix.join(dir, part)],
    );
  }
  return dirs;
}

/** `title` and `order` from a page's front matter; the first `# ` heading stands in for a title. */
function pageMeta(markdown: string): { title?: string; order?: number } {
  const front = /^---\n([\s\S]*?)\n---/.exec(markdown)?.[1] ?? "";
  const field = (key: string) => new RegExp(`^${key}:\\s*(.+?)\\s*$`, "m").exec(front)?.[1];
  const title = field("title")?.replace(/^(["'])(.*)\1$/, "$2") ?? /^# (.+)$/m.exec(markdown)?.[1];
  const order = field("order");
  return { title, order: order === undefined ? undefined : Number(order) };
}

function docPages(dir: string): DocPage[] {
  const root = join(repoRoot, dir, "docs");
  if (!existsSync(root)) return [];
  const walk = (sub: string): string[] =>
    readdirSync(join(root, sub), { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(posix.join(sub, e.name)) : e.name.endsWith(".md") ? [posix.join(sub, e.name)] : [],
    );
  return walk("")
    .map((rel) => {
      const { title, order } = pageMeta(readFileSync(join(root, rel), "utf8"));
      const page = rel.replace(/\.md$/, "");
      return { file: posix.join(dir, "docs", rel), page, title: title ?? page, order: order ?? Infinity };
    })
    .toSorted((a, b) => a.order - b.order || a.page.localeCompare(b.page));
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
      enumeratio?: { group?: string };
    };
    if (!pkg.name?.startsWith("@enumeratio/")) continue;
    const siblings = (deps = {}) => Object.keys(deps).filter((d) => d.startsWith("@enumeratio/"));
    const deps = siblings(pkg.dependencies);
    const readme = join(repoRoot, dir, "README.md");
    const slug = pkg.name.slice("@enumeratio/".length);
    found.push({
      name: pkg.name,
      slug,
      description: pkg.description,
      dir,
      group: groupOf(slug, pkg.enumeratio?.group),
      deps,
      devDeps: siblings(pkg.devDependencies).filter((d) => !deps.includes(d)),
      readme: existsSync(readme) ? readme : undefined,
      pages: docPages(dir),
    });
  }
  return found.toSorted((a, b) => a.slug.localeCompare(b.slug));
}

/** The site route of a doc page: `guide/index` is served at `…/guide/`. */
export function docRoute(slug: string, page = "index"): string {
  return `/docs/${slug}/${page.replace(/(^|\/)index$/, "$1")}`;
}

type Routes = Map<string, string>;

/** Repo-relative paths the site serves (READMEs, package dirs, doc pages), to their routes. */
function siteRoutes(packages: WorkspacePackage[]): Routes {
  return new Map(
    packages.flatMap((p) => [
      [`${p.dir}/README.md`, docRoute(p.slug)],
      [p.dir, docRoute(p.slug)],
      ...p.pages.map((d): [string, string] => [d.file, docRoute(p.slug, d.page)]),
    ]),
  );
}

/**
 * Point a file's relative links where the site serves them, or at GitHub when it does not,
 * and absolute links to the site at the site itself. Other links, and anchors, are left alone.
 */
export function rewriteLinks(markdown: string, file: string, routes: Routes): string {
  const from = posix.dirname(relative(repoRoot, file).split("\\").join("/"));
  return markdown.replace(
    /(\]\()<?([^)\s#>]+)>?(#[^)\s]*)?(\s+"[^"]*")?\)/g,
    (whole, open, target: string, hash = "", title = "") => {
      if (target.startsWith(siteOrigin + "/")) return `${open}${target.slice(siteOrigin.length)}${hash}${title})`;
      if (/^([a-z]+:|\/|#)/i.test(target)) return whole;
      const path = posix.normalize(posix.join(from, target));
      const route = routes.get(path) ?? routes.get(path.replace(/\/$/, ""));
      return `${open}${route ? route + hash : githubBlob + path + hash}${title})`;
    },
  );
}

const link = (name: string) => {
  const slug = name.slice("@enumeratio/".length);
  return `[\`${slug}\`](${docRoute(slug)})`;
};

/** The package's landing page: its README (or description), its pages, then its edges. */
function packagePage(pkg: WorkspacePackage, routes: Routes): string {
  const body = pkg.readme
    ? rewriteLinks(readFileSync(pkg.readme, "utf8"), pkg.readme, routes)
    : `# ${pkg.name}\n\n${pkg.description ?? ""}\n`;
  const pages = pkg.pages.length
    ? `## Pages\n\n${pkg.pages.map((d) => `- [${d.title}](${docRoute(pkg.slug, d.page)})`).join("\n")}\n\n`
    : "";
  const facts = [
    `- Source: [\`${pkg.dir}\`](${githubBlob.replace("/blob/", "/tree/")}${pkg.dir})`,
    pkg.deps.length ? `- Depends on: ${pkg.deps.map(link).join(", ")}` : "",
    pkg.devDeps.length ? `- In development, also: ${pkg.devDeps.map(link).join(", ")}` : "",
  ].filter(Boolean);
  return `${body.trimEnd()}\n\n${pages}---\n\n${facts.join("\n")}\n`;
}

/** Every route under /docs/<slug>/ with its content, for `web/docs/[page].paths.ts`. */
export function docRoutes(): { params: { page: string }; content: string }[] {
  const packages = workspacePackages();
  const routes = siteRoutes(packages);
  return packages.flatMap((pkg) => [
    { params: { page: `${pkg.slug}/index` }, content: packagePage(pkg, routes) },
    ...pkg.pages.map((d) => ({
      params: { page: `${pkg.slug}/${d.page}` },
      content: rewriteLinks(readFileSync(join(repoRoot, d.file), "utf8"), join(repoRoot, d.file), routes),
    })),
  ]);
}

/** The Docs sidebar's package part: one collapsed group each, its pages under it. */
export function docsSidebar() {
  const packages = workspacePackages();
  return groups.map((group) => ({
    text: group[0].toUpperCase() + group.slice(1),
    collapsed: true,
    items: packages
      .filter((p) => p.group === group)
      .map((p) => ({
        text: p.slug,
        link: docRoute(p.slug),
        ...(p.pages.length && {
          collapsed: true,
          items: p.pages.map((d) => ({ text: d.title, link: docRoute(p.slug, d.page) })),
        }),
      })),
  }));
}
