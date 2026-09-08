// Vite's `?inline` query returns a stylesheet's text as a string (used to fold KaTeX's layout CSS into a Lit
// component's shadow root). tsc has no notion of the query, so declare it here; Vite resolves it at build time.
declare module '*.css?inline' {
  const css: string
  export default css
}
