// The design and package indexes: titles and descriptions, read in node, shipped as data.

import { readFileSync } from "node:fs";
import { defineLoader } from "vitepress";
import { designDocs, workspacePackages } from "./repo-docs.ts";

export interface RepoDocs {
  design: { slug: string; title: string }[];
  packages: { slug: string; name: string; description?: string }[];
}

declare const data: RepoDocs;
export { data };

export default defineLoader({
  watch: ["../../../design/*.md", "../../../packages/**/package.json"],
  load: (): RepoDocs => ({
    design: designDocs().map(({ slug, file }) => {
      const title = /^# (?:Design: )?(.+)$/m.exec(readFileSync(file, "utf8"))?.[1] ?? slug;
      return { slug, title: title[0].toUpperCase() + title.slice(1) };
    }),
    packages: workspacePackages().map(({ slug, name, description }) => ({ slug, name, description })),
  }),
});
