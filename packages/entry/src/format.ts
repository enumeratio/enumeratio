// The repo's formatter settings, in one place: the root vite.config.ts reads them for `vp fmt`,
// and the record writer (node.ts) hands them to oxfmt, so the two can't disagree.

export const FORMAT = { printWidth: 120 } as const;
