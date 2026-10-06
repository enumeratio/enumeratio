# @enumeratio/config

The formatter and linter settings for `vp check`, shared by every enumeratio package.

```ts
// vite.config.ts
import { defineConfig } from "vite-plus";
import { fmt, lint } from "@enumeratio/config";

export default defineConfig({ fmt, lint });
```

Add the package as a devDependency. A repository's own overrides go beside the spread: `lint: { ...lint, overrides: [...] }`.
