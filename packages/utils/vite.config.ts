import { defineConfig } from "vite-plus";
import { fmt, lint } from "@enumeratio/config";

export default defineConfig({
  pack: {
    deps: { resolveDepSubpath: true },
    dts: {
      generator: "tsgo",
      tsconfig: "tsconfig.dts.json",
    },
    exports: true,
  },
  lint,
  fmt,
});
