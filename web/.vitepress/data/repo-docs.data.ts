// The package index: names and descriptions, read in node, shipped as data.

import { defineLoader } from "vitepress";
import { workspacePackages } from "./repo-docs.ts";

export interface RepoDocs {
  packages: { slug: string; name: string; description?: string }[];
}

declare const data: RepoDocs;
export { data };

export default defineLoader({
  watch: ["../../../packages/**/package.json"],
  load: (): RepoDocs => ({
    packages: workspacePackages().map(({ slug, name, description }) => ({ slug, name, description })),
  }),
});
