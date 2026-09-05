-- requires: words, glyphs
-- word_glyph — the page-space glyph for the k-ary word carrier (#145 glyph bald spot): a horizontal row of cells,
-- one per letter, generalizing cells_svg's 0/1 binary_word strip to an arbitrary alphabet. ~dozens of word-family
-- collections (words, and anything that borrows the word carrier) inherit this for free.
--
-- Color scheme: a MONOCHROME RAMP on --enumeratio-accent, tinted by each letter's position within the word's own
-- observed range [1, max(letters)] — the lowest letter present renders faintest, the highest strongest, everything
-- between interpolates linearly. The `word` carrier has no `base` field on the VALUE (only on words_fiber — see
-- words.sql), so a fixed per-letter palette would either run out for a big alphabet or be arbitrary, and there's no
-- true alphabet size to read off a bare value anyway. Scaling to what's actually IN the word is the same call
-- glyphs.sql made for finset's unbounded (α=ℕ) mode. A uniform word (every letter equal) renders as one flat tint —
-- that's the correct degenerate case, not a bug. The letter digit is also printed in each cell, so the glyph reads
-- correctly even where the ramp alone can't disambiguate (e.g. only two letters present).
CREATE FUNCTION word_cells_svg(letters int[], unit numeric DEFAULT 22) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH b AS (SELECT o - 1 AS i, letter FROM unnest(letters) WITH ORDINALITY AS t(letter, o)),
  mx AS (SELECT greatest(1, coalesce(max(letter), 1)) AS maxletter FROM b),
  dim AS (SELECT greatest(1, count(*)) * unit AS w FROM b)
  SELECT format(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 %s %s" role="img" aria-label="word">%s</svg>',
    trim_scale(round((SELECT w FROM dim) + 2, 2)), trim_scale(round(unit + 2, 2)),
    (SELECT string_agg(format(
      '<rect x="%1$s" y="0" width="%2$s" height="%2$s" rx="2" fill="%3$s" stroke="var(--enumeratio-border,currentColor)" stroke-width="1"/>'
      '<text x="%4$s" y="%5$s" text-anchor="middle" dominant-baseline="central" font-size="%6$s" fill="var(--enumeratio-text,currentColor)">%7$s</text>',
      trim_scale(round(i * unit, 2)), trim_scale(round(unit, 2)),
      format('color-mix(in srgb, var(--enumeratio-accent,#10b981) %s%%, transparent)',
             trim_scale(round(18 + 60.0 * (letter - 1) / greatest(maxletter - 1, 1), 2))),
      trim_scale(round(i * unit + unit / 2, 2)), trim_scale(round(unit / 2, 2)), trim_scale(round(unit * 0.5, 2)), letter
    ), '' ORDER BY i) FROM b, mx));
$$;
CREATE FUNCTION glyph_svg(w word) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT word_cells_svg((w).letters) $$;

-- Assert the GEOMETRY (as glyphs.sql does for its own carriers), not the styling.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','glyph_svg emits a self-contained svg for a word','eq','<svg…</svg>','words(3,3) rank 5 = 1,3,3',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg((unrank(words(3,3),5)).value) g) s $q$),
  ('glyphs','carrier_renders_svg is now true for the word carrier','eq','true','glyph_svg(word) overload alone lights this up — no base_glyph row',$q$
    SELECT carrier_renders_svg('word')::text $q$),
  ('glyphs','word cell strip viewBox + cell count tracks length (3 letters, unit 22)','eq','-1 -1 68 24|3','w = 3*22+2, h = 22+2; one <rect> per letter',$q$
    SELECT substring(g FROM 'viewBox="([^"]+)"') || '|' || (length(g) - length(replace(g, '<rect', '')))/5
    FROM (SELECT word_cells_svg(ARRAY[1,2,3]) g) s $q$),
  ('glyphs','word cell strip labels every cell with its letter (1,2,3 all present)','eq','true','letters render as text content, not just tinted boxes',$q$
    SELECT (g LIKE '%>1</text>%' AND g LIKE '%>2</text>%' AND g LIKE '%>3</text>%')::text
    FROM (SELECT word_cells_svg(ARRAY[1,2,3]) g) s $q$),
  ('glyphs','word cell ramp: distinct letters get distinct fill tints (1,2,3 span the observed range)','eq','3','three cells, three different color-mix percentages',$q$
    SELECT count(DISTINCT m[1])::text FROM (SELECT regexp_matches(g, 'color-mix\(in srgb, var\(--enumeratio-accent,#10b981\) ([0-9.]+)%', 'g') m
      FROM (SELECT word_cells_svg(ARRAY[1,2,3]) g) s) t $q$),
  ('glyphs','word cell ramp: a uniform word (every letter equal) renders one flat tint','eq','1','monochrome edge case — max letter = the only value present, so every cell gets the same pct',$q$
    SELECT count(DISTINCT m[1])::text FROM (SELECT regexp_matches(g, 'color-mix\(in srgb, var\(--enumeratio-accent,#10b981\) ([0-9.]+)%', 'g') m
      FROM (SELECT word_cells_svg(ARRAY[2,2,2]) g) s) t $q$),
  ('glyphs','word_cells_svg on the empty word (length 0) renders no cells, a collapsed 1-unit-wide strip','eq','-1 -1 24 24|0','empty edge case — greatest(1,count(*)) keeps the viewBox non-degenerate',$q$
    SELECT substring(g FROM 'viewBox="([^"]+)"') || '|' || (length(g) - length(replace(g, '<rect', '')))/5
    FROM (SELECT word_cells_svg(ARRAY[]::int[]) g) s $q$),
  ('glyphs','glyph_svg dispatches word to word_cells_svg','eq','true','carrier→helper wiring, same pattern as ferrers/cells/composition',$q$
    SELECT (glyph_svg(ROW(ARRAY[1,3,3])::word) = word_cells_svg(ARRAY[1,3,3]))::text $q$);
