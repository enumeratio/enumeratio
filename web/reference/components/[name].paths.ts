import { collectComponents } from "../../.vitepress/data/components.ts";

// One generated page per element module in @enumeratio/components.
export default {
  paths() {
    return collectComponents().map((component) => ({ params: { name: component.tag } }));
  },
};
