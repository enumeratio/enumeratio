import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    dts: { generator: "tsgo", tsconfig: "tsconfig.dts.json" },
  },
});
