// The package index for /docs: names, descriptions and pages by group, read in node, shipped as data.

import { defineLoader } from "vitepress";
import { docRoute, groups, workspacePackages } from "./repo-docs.ts";

export interface RepoDocs {
  groups: {
    name: string;
    packages: { slug: string; name: string; description?: string; pages: { title: string; link: string }[] }[];
  }[];
}

declare const data: RepoDocs;
export { data };

export default defineLoader({
  watch: ["../../../{packages,tools,upstream}/**/{package.json,README.md,docs/**/*.md}"],
  load: (): RepoDocs => {
    const packages = workspacePackages();
    return {
      groups: groups.map((name) => ({
        name,
        packages: packages
          .filter((p) => p.group === name)
          .map(({ slug, name, description, pages }) => ({
            slug,
            name,
            description,
            pages: pages.map((d) => ({ title: d.title, link: docRoute(slug, d.page) })),
          })),
      })),
    };
  },
});
