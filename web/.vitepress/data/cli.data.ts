// Ships the CLI's own surface to the browser. The parse runs against @enumeratio/cli's
// source, so it can only run in node; this loader hands the result to the client as
// static data, and re-runs when the CLI's usage, completion or form tables change.

import { defineLoader } from "vitepress";
import { type CliData, cliData } from "./cli.ts";

export type { CliData, CliForm, CliRow } from "./cli.ts";

declare const data: CliData;
export { data };

export default defineLoader({
  watch: [
    "../../../packages/cli/src/command.ts",
    "../../../packages/cli/src/completion.ts",
    "../../../packages/cli/src/engine.ts",
  ],
  load: (): CliData => cliData,
});
