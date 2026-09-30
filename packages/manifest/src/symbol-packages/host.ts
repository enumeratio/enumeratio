// Where symbol packages come from: anything that serves a package version's files and lists
// its versions. npm and GitHub both do, through jsDelivr's mirrors, with CORS, so a page reads
// them the way a build does; a GitLab or private host is another implementation of the same.

/** Reads a URL as JSON; `fetch` by default, anything else in a test or a build cache. */
export type FetchJson = (url: string) => Promise<unknown>;

/** `fetch`, as JSON. */
export const fetchJson: FetchJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json();
};

export interface PackageHost {
  /** A file of a package version, as JSON. */
  file(name: string, version: string, path: string): Promise<unknown>;
  /** Every published version of a package. */
  versions(name: string): Promise<readonly string[]>;
  /** The namespace a package's name reserves (npm's scope, GitHub's owner), or undefined. */
  owner(name: string): string | undefined;
}

export interface JsdelivrOptions {
  readonly fetch?: FetchJson;
  /** jsDelivr's origins; a mirror or a test replaces them. */
  readonly cdn?: string;
  readonly data?: string;
}

/** A host served by jsDelivr: `npm` (`@ada/primes`) or `gh` (`ada/primes`, its tags). */
function jsdelivr(
  kind: "npm" | "gh",
  owner: (name: string) => string | undefined,
  {
    fetch = fetchJson,
    cdn = `https://cdn.jsdelivr.net/${kind}`,
    data = `https://data.jsdelivr.com/v1/packages/${kind}`,
  }: JsdelivrOptions,
): PackageHost {
  return {
    file: (name, version, path) => fetch(`${cdn}/${name}@${version}/${path.replace(/^\.\//, "")}`),
    versions: async (name) => {
      const listed = (await fetch(`${data}/${name}`)) as { versions: readonly { version: string }[] };
      return listed.versions.map((v) => v.version);
    },
    owner,
  };
}

/** npm, over jsDelivr: a scoped package's scope is its namespace. */
export const npmHost = (options: JsdelivrOptions = {}): PackageHost =>
  jsdelivr("npm", (name) => (name.startsWith("@") ? name.slice(1, name.indexOf("/")) : undefined), options);

/** GitHub repositories, over jsDelivr, versioned by their tags: the owner is the namespace. */
export const githubHost = (options: JsdelivrOptions = {}): PackageHost =>
  jsdelivr("gh", (name) => name.slice(0, name.indexOf("/")), options);
