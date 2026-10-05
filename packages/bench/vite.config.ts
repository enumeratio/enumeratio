import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    // harness-ts.ts runs as its own process; the declarations are of the library.
    dts: { tsconfig: "tsconfig.dts.json" },
  },
  lint: {
    options: { typeAware: true, typeCheck: true },
  },
  fmt: {},
});
