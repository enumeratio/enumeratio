// Minimal ambient decls for the Vite worker imports the browser client uses (the client tsconfig doesn't pull in
// vite/client). Only what session.ts needs.
declare module '*?sharedworker' {
  const ctor: { new (options?: { name?: string }): SharedWorker }
  export default ctor
}
declare module '*?worker' {
  const ctor: { new (options?: { name?: string }): Worker }
  export default ctor
}
