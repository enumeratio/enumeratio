// See ./types.ts: the implementations rule lives in `@enumeratio/entry`, so every package
// holding entries can enforce it over its own.
export { checkImplementations, type Exists, type Problem } from "@enumeratio/entry";
