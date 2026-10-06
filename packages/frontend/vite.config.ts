import { defineConfig } from "vite-plus";
import { fmt, lint } from "@enumeratio/config";

export default defineConfig({
  pack: {
    deps: { resolveDepSubpath: true },
    dts: { generator: "tsgo", tsconfig: "tsconfig.dts.json" },
    // The generated export map, plus what the build writes after packing (collect-declares).
    exports: {
      customExports(exports) {
        exports["./declares.json"] = "./dist/declares.json";
        return exports;
      },
    },
  },
  lint,
  fmt,
});
