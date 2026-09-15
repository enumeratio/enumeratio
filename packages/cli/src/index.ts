// Node surface (`.` entry): the browser-safe core plus the Node adapter — the
// interactive loop, command runner, and graphic rendering. The bin and tests
// import from here; browser hosts import "@enumeratio/cli/browser" instead.

export * from "./browser.ts";
export { main } from "./cli-main.ts";
export { type ConfigFile, configPaths, loadConfig, parseConfig } from "./config.ts";
export { type HostOutput, NodeHost } from "./node-host.ts";
export { graphicLabel, graphicToSvg } from "./node-graphics.ts";
export { runRepl } from "./repl.ts";
export { DEFAULT_PORT, handleRequest, type Reply, runServe, type ServeOptions } from "./serve.ts";
