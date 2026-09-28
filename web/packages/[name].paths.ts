import { packagePage, workspacePackages } from "../.vitepress/data/repo-docs.ts";

// One page per workspace package: its README, or its package.json description.
export default {
  paths() {
    return workspacePackages().map((pkg) => ({ params: { name: pkg.slug }, content: packagePage(pkg) }));
  },
};
