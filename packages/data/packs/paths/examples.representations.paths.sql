-- requires: representations, colored_motzkin_paths
-- paths half of sqlsrc/representations.sql (#283 phase 3 extraction) — the colored_motzkin_paths `steps` repr,
-- its katex render function (takes a `paths`-pack carrier type as its parameter, so it can't even CREATE FUNCTION
-- loading core alone), its base_repr rows, and its example. base_repr.collection REFERENCES base_collection, so
-- the rows would also FK-fail loading core alone.

-- katex spelling of the colored_motzkin_path default U/D/H_c step word: arrows for the three step kinds — U → \uparrow,
-- D → \downarrow, a colored level step H_c → \rightarrow_{c} — joined by a thin space, e.g. "UH0D" → "\uparrow\,
-- \rightarrow_{0}\,\downarrow" — matches the render-corpus oracle's r≥2 rows (the r=1 corpus rows use a bare "H" with
-- no color digit; our own notation() always includes the color index even at r=1, so those specific rows aren't a
-- usable oracle — not a bug, just unresolvable, same shape as `redirected_paths`). asciimath coincides with the
-- unicode default (bare step letters either way) — no sibling.
CREATE FUNCTION colored_motzkin_path_katex(p colored_motzkin_path) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(string_agg(CASE s WHEN 1 THEN '\uparrow' WHEN -1 THEN '\downarrow' ELSE '\rightarrow_{' || c || '}' END, '\,' ORDER BY o), '')
  FROM unnest((p).steps, (p).colors) WITH ORDINALITY AS t(s, c, o) $$;

-- colored_motzkin_paths `steps` IS its collection's unconditional default (render_fn='notation', no branching
-- besides what the katex sibling already replicates) — same shape as fractional_numbers `fraction` in core.
INSERT INTO base_repr (collection, repr, render_fn, title, canonical) VALUES
  ('colored_motzkin_paths','steps','notation','Step word',true);
INSERT INTO base_repr (collection, repr, render_fn, title, canonical, medium) VALUES
  ('colored_motzkin_paths','steps','colored_motzkin_path_katex','Step word (KaTeX arrows)',false,'latex');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('representations','the default (unicode) colored_motzkin_path notation is unchanged: UH0D stays UH0D (bare step letters)','eq','UH0D','notation(colored_motzkin_path) still the plain U/D/H_c word',$q$
    SELECT notation(ROW(ARRAY[1,0,-1],ARRAY[-1,0,-1])::colored_motzkin_path) $q$);
