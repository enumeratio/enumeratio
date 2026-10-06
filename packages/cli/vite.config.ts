import { defineConfig } from "vite-plus";
import { fmt, lint } from "@enumeratio/config";

export default defineConfig({
  fmt,
  lint,
  pack: {
    dts: { generator: "tsgo", tsconfig: "tsconfig.dts.json" },
  },
});
