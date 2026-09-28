// Ships the parsed component surface to the browser. The parser itself reads the
// filesystem, so it can only run in node; this loader hands its output to the client as
// static data, and re-runs when an element's source changes.

import { defineLoader } from "vitepress";
import { type ComponentDoc, collectComponents } from "./components.ts";

export type { AttributeDoc, ComponentDoc } from "./components.ts";

declare const data: readonly ComponentDoc[];
export { data };

export default defineLoader({
  watch: ["../../../packages/components/src/notatio-*.ts"],
  load: (): readonly ComponentDoc[] => collectComponents(),
});
