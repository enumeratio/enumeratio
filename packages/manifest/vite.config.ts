import { existsSync, readdirSync } from "node:fs";
import { defineConfig } from "vite-plus";

// One entry per package module scripts/build.ts wrote, so each is its own `./package/<name>`.
const generated = "src/generated/package";
const packages = existsSync(generated) ? readdirSync(generated).filter((f) => f.endsWith(".ts")) : [];

export default defineConfig({
  pack: {
    entry: {
      index: "src/index.ts",
      libraries: "src/libraries/index.ts",
      ...Object.fromEntries(packages.map((f) => [`package/${f.slice(0, -3)}`, `${generated}/${f}`])),
    },
    dts: { generator: "tsgo" },
  },
  lint: {
    options: { typeAware: true, typeCheck: true },
  },
  fmt: {},
});
