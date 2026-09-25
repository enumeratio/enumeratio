// Wolfram's `TeXForm` writes the natural log `Log[x]` as a bare `\log` and a based one as
// `\log_b`. notatio keeps `\ln` for the natural log and writes every other `\log` with its
// base, so the one dialect difference is the bare `\log`.

/** A `\log` with no base subscript: Wolfram's natural log. */
const NATURAL_LOG = /\\log(?![a-zA-Z])(?!\s*_)/g;
const LN = /\\ln(?![a-zA-Z])/g;

/** Wolfram `TeXForm` output in notatio's spelling: `\log(x)` → `\ln(x)`. */
export const fromWolframTeX = (tex: string): string => tex.replace(NATURAL_LOG, "\\ln");

/** notatio's TeX in Wolfram's spelling: `\ln(x)` → `\log(x)`. */
export const toWolframTeX = (tex: string): string => tex.replace(LN, "\\log");
