// @enumeratio/frontend: the base of the notation layer, with nothing of any UI framework
// in it -- the map from symbols to the components that draw them and the lowering of
// arguments into attributes (`symbols.ts`), the arithmetic of scrubbing and playback,
// the control contract, and the pure renderers that turn data into SVG. The components
// (`@enumeratio/components`) and the framework mirrors are built on this.
export * from "./core.ts";
export * from "./declare-carriers.ts";
export * from "./complex-eval.ts";
export * from "./conventional-latex.ts";
export * from "./source.ts";
export * from "./symbols.ts";
export * from "./tracked-symbols.ts";
export * from "./vdom.ts";
export * from "./head-names.ts";
export * from "./reduce.ts";
export * from "./plot-compile.ts";
