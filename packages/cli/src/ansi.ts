// ANSI styling, decoupled from any output stream. Every helper takes an `on`
// flag so a caller (a non-TTY pipe, a golden test) can render the same string
// without escape codes. xterm and a TTY render the codes natively.

const wrap =
  (code: string) =>
  (s: string, on = true): string =>
    on ? `\x1b[${code}m${s}\x1b[0m` : s;

export const bold = wrap("1");
export const dim = wrap("2");
export const red = wrap("31");
export const green = wrap("32");
export const yellow = wrap("33");
export const blue = wrap("34");
export const magenta = wrap("35");
export const cyan = wrap("36");

// ESC assembled from its code point so the source carries no control character.
const ANSI_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

/** Strip every SGR escape — for non-TTY output and stable text assertions. */
export const stripAnsi = (s: string): string => s.replace(ANSI_PATTERN, "");
