declare module "*.css";

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<Record<string, unknown>, object, unknown>;
  export default component;
}

/** The documented reference entries, one per head (.vitepress/reference-data.ts). */
declare module "virtual:reference-entries" {
  const entries: readonly import("@enumeratio/reference").ReferenceEntry[];
  export default entries;
}
