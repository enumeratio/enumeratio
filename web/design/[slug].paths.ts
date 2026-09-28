import { readFileSync } from "node:fs";
import { designDocs, rewriteLinks } from "../.vitepress/data/repo-docs.ts";

// One page per top-level design/*.md, read from where it lives.
export default {
  paths() {
    return designDocs().map(({ slug, file }) => ({
      params: { slug },
      content: rewriteLinks(readFileSync(file, "utf8"), file),
    }));
  },
};
