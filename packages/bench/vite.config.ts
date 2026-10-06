import { defineConfig } from "vite-plus";
import { fmt, lint } from "@enumeratio/config";

export default defineConfig({
  pack: {
    // harness-ts.ts runs as its own process; the declarations are of the library.
    dts: { tsconfig: "tsconfig.dts.json" },
  },
  lint,
  fmt,
});
