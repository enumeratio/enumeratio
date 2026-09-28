import { collectComponents } from "../../.vitepress/data/components.ts";

// One generated page per element module in @enumeratio/frontend, at its Vue/React name
// (`/reference/component/BarChart3D`) -- the same rule /reference/symbol/<Head> follows.
export default {
  paths() {
    return collectComponents().map((component) => ({ params: { name: component.name } }));
  },
};
