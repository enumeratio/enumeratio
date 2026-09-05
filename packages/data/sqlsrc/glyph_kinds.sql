-- requires: glyphs, permutation_glyph, decorated_permutation_glyph, endofunction_glyph, integer_partitions.stats
-- glyph_kinds — multi-kind figures via glyph_svg(carrier, kind) (catalog audit friction 6). base_glyph already had
-- a `kind` column the single-arg glyph_svg(<carrier>) overload never read: a partition wants Ferrers AND a Young
-- diagram AND an abacus; a permutation wants a matrix AND an arc diagram AND a cycle diagram AND a Rothe diagram.
--
-- CRITICAL: this file ADDS a glyph_svg(<carrier>, kind text) overload per carrier below — it never redefines or
-- removes the existing single-arg glyph_svg(<carrier>) overload (glyphs.sql / permutation_glyph.sql are untouched).
-- The default kind of every 2-arg dispatcher delegates straight to the 1-arg overload (`glyph_svg(p)`), so its
-- output stays byte-identical; every OTHER kind is a genuinely different figure, reusing an existing generator where
-- one already draws the right picture (permutation_arc_svg, endofunction_graph_svg, partition_beta_set) rather than
-- re-deriving the geometry.
--
-- base_glyph was `PRIMARY KEY (carrier)` — one row per carrier, a single "this is the picture" hint. Multi-kind
-- figures need more than one row per carrier, so it grows an `is_default` flag and the PK widens to (carrier, kind).
-- No existing row changes meaning: ADD COLUMN backfills is_default = true on every row already there (today's one
-- glyph per carrier IS the default), and the six existing single-row carriers (integer_partition, dyck_path,
-- motzkin_path, binary_word, finset, set_partition) are untouched besides that flag.
ALTER TABLE base_glyph ADD COLUMN is_default boolean NOT NULL DEFAULT true;
ALTER TABLE base_glyph DROP CONSTRAINT base_glyph_pkey;
ALTER TABLE base_glyph ADD CONSTRAINT base_glyph_pkey PRIMARY KEY (carrier, kind);

-- ── permutation: matrix (have, default) + arc diagram + cycle diagram + Rothe diagram ──────────────────────────
-- Rothe diagram: D(w) = { (i,j) : j < w(i), w⁻¹(j) > i } — the cells left standing after crossing out, in row i,
-- every cell at/right of the dot (i, w(i)), and in column w(i) every cell at/below it. |D(w)| = inv(w); its row
-- lengths are exactly the Lehmer code. Grid + permutation-matrix dots (as permutation_matrix_svg draws them) plus a
-- tinted square per diagram cell.
CREATE FUNCTION permutation_rothe_svg(image int[], unit numeric DEFAULT 22) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH dim AS (SELECT greatest(1, coalesce(array_length(image, 1), 0)) AS n),
  inv AS (SELECT val, o AS pos FROM unnest(image) WITH ORDINALITY AS t(val, o)),          -- inv.pos = w⁻¹(val)
  cells AS (
    SELECT i, j FROM dim, LATERAL generate_series(1, n) i, LATERAL generate_series(1, n) j
    WHERE j < image[i] AND (SELECT pos FROM inv WHERE val = j) > i
  ),
  geo AS (SELECT n * unit AS w FROM dim)
  -- args: 1=w+2 (viewBox, square) · 2=grid (n² light borders) · 3=diagram cells (tinted squares) · 4=dots (the
  -- permutation matrix, one per row)
  SELECT format(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 %1$s %1$s" role="img" aria-label="Rothe diagram">%2$s%3$s%4$s</svg>',
    (SELECT w FROM geo) + 2,
    (SELECT string_agg(format(
      '<rect x="%s" y="%s" width="%s" height="%s" fill="none" stroke="var(--enumeratio-border,currentColor)" stroke-width="1" opacity="0.4"/>',
      (c - 1) * unit, (r - 1) * unit, unit, unit), '' ORDER BY r, c)
     FROM dim, LATERAL generate_series(1, n) r, LATERAL generate_series(1, n) c),
    coalesce((SELECT string_agg(format(
      '<rect x="%s" y="%s" width="%s" height="%s" fill="color-mix(in srgb, var(--enumeratio-accent,#d97706) 30%%, transparent)"/>',
      trim_scale(round((c.j - 1) * unit, 2)), trim_scale(round((c.i - 1) * unit, 2)), unit, unit), '' ORDER BY c.i, c.j)
     FROM cells c), ''),
    (SELECT string_agg(format(
      '<circle cx="%s" cy="%s" r="%s" fill="var(--enumeratio-accent,#d97706)"/>',
      trim_scale(round((val - 0.5) * unit, 2)), trim_scale(round((o - 0.5) * unit, 2)), round(unit * 0.32, 2)),
      '' ORDER BY o) FROM unnest(image) WITH ORDINALITY AS t(val, o)));
$$;

CREATE FUNCTION glyph_svg(p permutation, kind text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE coalesce(kind, 'matrix')
    WHEN 'matrix'        THEN glyph_svg(p)                             -- the 1-arg overload, unchanged — byte-identical
    WHEN 'arc'            THEN permutation_arc_svg((p).image)           -- decorated_permutation_glyph's generator, undecorated
    WHEN 'cycle_diagram'  THEN endofunction_graph_svg((p).image)        -- a bijective endofunction IS a union of cycles
    WHEN 'rothe'          THEN permutation_rothe_svg((p).image)
    ELSE glyph_svg(p)                                                   -- an unknown kind falls back to the default picture
  END
$$;

INSERT INTO base_glyph (carrier, kind, title, is_default) VALUES
  ('permutation', 'matrix',        'Permutation matrix', true),
  ('permutation', 'arc',           'Arc diagram',         false),
  ('permutation', 'cycle_diagram', 'Cycle diagram',       false),
  ('permutation', 'rothe',         'Rothe diagram',       false);

-- ── integer_partition: Ferrers (have, default) + Young (English/French) + abacus ────────────────────────────────
-- Young diagram, FRENCH notation: same boxes as Ferrers/English, rows flipped vertically so the LARGEST part sits
-- at the bottom (English/Ferrers already puts it at the top — see glyphs.sql's ferrers_svg).
CREATE FUNCTION young_diagram_french_svg(parts int[], unit numeric DEFAULT 18) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH p AS (SELECT o AS r, part FROM unnest(parts) WITH ORDINALITY AS t(part, o)),
  dim AS (SELECT greatest(1, coalesce(max(part), 0)) * unit AS w, greatest(1, count(*)) * unit AS h, count(*) AS rows FROM p),
  cells AS (SELECT (c - 1) * unit AS x, ((SELECT rows FROM dim) - r) * unit AS y FROM p, LATERAL generate_series(1, part) c)
  SELECT format(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 %s %s" role="img" aria-label="Young diagram (French)">%s</svg>',
    (SELECT w FROM dim) + 2, (SELECT h FROM dim) + 2,
    (SELECT string_agg(format(
      '<rect x="%s" y="%s" width="%s" height="%s" rx="1.5" fill="color-mix(in srgb, var(--enumeratio-accent,#d97706) 16%%, transparent)" stroke="var(--enumeratio-accent,#d97706)" stroke-width="1"/>',
      x, y, unit, unit), '' ORDER BY y, x) FROM cells));
$$;

-- Abacus (Maya diagram): partition_beta_set(p)'s beta-numbers as beads on ONE runner, 0..max(beta) — filled where a
-- beta-number sits, hollow otherwise (the SVG twin of integer_partitions.frobenius_abacus.sql's text bead string).
CREATE FUNCTION integer_partition_abacus_svg(beta int[], unit numeric DEFAULT 20) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH dim AS (SELECT greatest(0, coalesce((SELECT max(x) FROM unnest(beta) x), 0)) AS maxpos),
  positions AS (SELECT i, (i = ANY(beta)) AS bead FROM dim, LATERAL generate_series(0, maxpos) i)
  -- args: 1=w+2 2=h+2 (viewBox) · 3=cy (runner y) · 4=w (runner extent) · 5=beads (filled = a beta-number, hollow otherwise)
  SELECT format(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 %1$s %2$s" role="img" aria-label="abacus (beta-set)">'
    '<line x1="0" y1="%3$s" x2="%4$s" y2="%3$s" stroke="var(--enumeratio-border,currentColor)" stroke-width="1" opacity="0.4"/>'
    '%5$s</svg>',
    trim_scale(round((SELECT maxpos FROM dim) * unit + unit + 2, 2)), trim_scale(round(unit + 2, 2)),
    trim_scale(round(unit / 2, 2)), trim_scale(round((SELECT maxpos FROM dim) * unit, 2)),
    (SELECT string_agg(format(
      '<circle cx="%s" cy="%s" r="%s" fill="%s" stroke="var(--enumeratio-accent,#d97706)" stroke-width="1.5"/>',
      trim_scale(round(i * unit, 2)), trim_scale(round(unit / 2, 2)), round(unit * 0.3, 2),
      CASE WHEN bead THEN 'var(--enumeratio-accent,#d97706)' ELSE 'none' END
    ), '' ORDER BY i) FROM positions));
$$;

CREATE FUNCTION glyph_svg(p integer_partition, kind text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE coalesce(kind, 'ferrers')
    WHEN 'ferrers'        THEN glyph_svg(p)                             -- the 1-arg overload, unchanged — byte-identical
    WHEN 'young_english'  THEN glyph_svg(p)                             -- same boxes/orientation ferrers_svg already draws
    WHEN 'young_french'   THEN young_diagram_french_svg((p).parts)
    WHEN 'abacus'         THEN integer_partition_abacus_svg(partition_beta_set(p))
    ELSE glyph_svg(p)                                                   -- an unknown kind falls back to the default picture
  END
$$;

INSERT INTO base_glyph (carrier, kind, title, is_default) VALUES
  ('integer_partition', 'young_english', 'Young diagram (English)', false),
  ('integer_partition', 'young_french',  'Young diagram (French)',  false),
  ('integer_partition', 'abacus',        'Abacus (Maya diagram)',   false);

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  -- the CRITICAL invariant: the single-arg overloads are untouched, byte-identical before/after this file.
  ('glyphs','the 1-arg glyph_svg(permutation) is unchanged: still permutation_matrix_svg','eq','true','2413, same check as permutation_glyph.sql''s own example',$q$
    SELECT (glyph_svg(ROW(ARRAY[2,4,1,3])::permutation) = permutation_matrix_svg(ARRAY[2,4,1,3]))::text $q$),
  ('glyphs','the 1-arg glyph_svg(integer_partition) is unchanged: still ferrers_svg','eq','true','3+1, same check as glyphs.sql''s own example',$q$
    SELECT (glyph_svg(ROW(ARRAY[3,1])::integer_partition) = ferrers_svg(ARRAY[3,1]))::text $q$),

  -- 2-arg dispatch: the default kind (bare or NULL) equals the 1-arg overload exactly.
  ('glyphs','glyph_svg(permutation, ''matrix'') and glyph_svg(permutation, NULL) both equal the 1-arg overload','eq','true|true','the default kind delegates, it does not re-derive',$q$
    SELECT (glyph_svg(ROW(ARRAY[2,4,1,3])::permutation, 'matrix') = glyph_svg(ROW(ARRAY[2,4,1,3])::permutation))::text
        || '|' || (glyph_svg(ROW(ARRAY[2,4,1,3])::permutation, NULL) = glyph_svg(ROW(ARRAY[2,4,1,3])::permutation))::text $q$),
  ('glyphs','glyph_svg(integer_partition, ''ferrers'') and (..., NULL) both equal the 1-arg overload','eq','true|true','the default kind delegates, it does not re-derive',$q$
    SELECT (glyph_svg(ROW(ARRAY[3,1])::integer_partition, 'ferrers') = glyph_svg(ROW(ARRAY[3,1])::integer_partition))::text
        || '|' || (glyph_svg(ROW(ARRAY[3,1])::integer_partition, NULL) = glyph_svg(ROW(ARRAY[3,1])::integer_partition))::text $q$),

  -- permutation alternate kinds dispatch to the right generator.
  ('glyphs','glyph_svg(permutation, ''arc'') dispatches to permutation_arc_svg (undecorated)','eq','true','same generator arrangement/decorated_permutation reuse',$q$
    SELECT (glyph_svg(ROW(ARRAY[2,4,1,3])::permutation, 'arc') = permutation_arc_svg(ARRAY[2,4,1,3]))::text $q$),
  ('glyphs','glyph_svg(permutation, ''cycle_diagram'') dispatches to endofunction_graph_svg','eq','true','a permutation''s functional graph IS its cycle decomposition',$q$
    SELECT (glyph_svg(ROW(ARRAY[2,4,1,3])::permutation, 'cycle_diagram') = endofunction_graph_svg(ARRAY[2,4,1,3]))::text $q$),
  ('glyphs','glyph_svg(permutation, ''rothe'') dispatches to permutation_rothe_svg','eq','true','carrier→helper wiring',$q$
    SELECT (glyph_svg(ROW(ARRAY[2,4,1,3])::permutation, 'rothe') = permutation_rothe_svg(ARRAY[2,4,1,3]))::text $q$),
  ('glyphs','Rothe diagram cell count = inversions: 2413 has 3 inversions, 3 diagram cells','eq','3|3','|D(w)| = inv(w)',$q$
    SELECT perm_inversions(ROW(ARRAY[2,4,1,3])::permutation)::text
        || '|' || (SELECT count(*) FROM regexp_matches(g, 'fill="color-mix\(in srgb, var\(--enumeratio-accent,#d97706\) 30%', 'g'))::text
    FROM (SELECT permutation_rothe_svg(ARRAY[2,4,1,3]) g) s $q$),
  ('glyphs','Rothe diagram on the identity has zero diagram cells (no inversions)','eq','0','123 is already sorted',$q$
    SELECT (SELECT count(*) FROM regexp_matches(g, 'fill="color-mix\(in srgb, var\(--enumeratio-accent,#d97706\) 30%', 'g'))::text
    FROM (SELECT permutation_rothe_svg(ARRAY[1,2,3]) g) s $q$),

  -- integer_partition alternate kinds dispatch to the right generator / geometry.
  ('glyphs','glyph_svg(integer_partition, ''young_english'') equals the 1-arg (Ferrers) overload — same orientation','eq','true','English notation is exactly what ferrers_svg already draws',$q$
    SELECT (glyph_svg(ROW(ARRAY[3,1])::integer_partition, 'young_english') = glyph_svg(ROW(ARRAY[3,1])::integer_partition))::text $q$),
  ('glyphs','glyph_svg(integer_partition, ''young_french'') dispatches to young_diagram_french_svg','eq','true','carrier→helper wiring',$q$
    SELECT (glyph_svg(ROW(ARRAY[3,1])::integer_partition, 'young_french') = young_diagram_french_svg(ARRAY[3,1]))::text $q$),
  ('glyphs','French notation flips the diagram: the 3-box row sits at the BOTTOM (y=18), not the top (y=0) as in ferrers/English','eq','0|18','the rect at x=36 only exists in the 3-part row (c=3, unit 18); its y tells us which row that is',$q$
    SELECT substring(ferrers_svg(ARRAY[3,1]) FROM '<rect x="36" y="([0-9.]+)"')
        || '|' || substring(young_diagram_french_svg(ARRAY[3,1]) FROM '<rect x="36" y="([0-9.]+)"') $q$),
  ('glyphs','glyph_svg(integer_partition, ''abacus'') dispatches to integer_partition_abacus_svg(beta_set)','eq','true','carrier→helper wiring, reuses the #230 beta-set',$q$
    SELECT (glyph_svg(ROW(ARRAY[3,1])::integer_partition, 'abacus') = integer_partition_abacus_svg(partition_beta_set(ROW(ARRAY[3,1])::integer_partition)))::text $q$),
  ('glyphs','abacus of 3+1 (beta {1,4}) draws 5 beads over positions 0..4, 2 of them filled','eq','5|2','matches integer_partitions.frobenius_abacus.sql''s ○●○○● bead string',$q$
    SELECT ((length(g) - length(replace(g, '<circle', '')))/7)::text
        || '|' || (SELECT count(*) FROM regexp_matches(g, 'fill="var\(--enumeratio-accent,#d97706\)"', 'g'))::text
    FROM (SELECT integer_partition_abacus_svg(ARRAY[1,4]) g) s $q$),
  ('glyphs','abacus of the empty partition (empty beta-set) draws a single hollow bead at position 0','eq','1|0',NULL,$q$
    SELECT ((length(g) - length(replace(g, '<circle', '')))/7)::text
        || '|' || (SELECT count(*) FROM regexp_matches(g, 'fill="var\(--enumeratio-accent,#d97706\)"', 'g'))::text
    FROM (SELECT integer_partition_abacus_svg(ARRAY[]::int[]) g) s $q$),

  -- registry rows + schema.
  ('glyphs','base_glyph now carries multiple kinds for permutation and integer_partition (a floor — more kinds may join)','eq','true|true','carrier→kind rows, is_default marks the one the 1-arg overload draws',$q$
    SELECT (SELECT (array_agg(kind) @> ARRAY['arc','cycle_diagram','matrix','rothe'])::text FROM base_glyph WHERE carrier = 'permutation')
        || '|' || (SELECT (array_agg(kind) @> ARRAY['abacus','ferrers','young_english','young_french'])::text FROM base_glyph WHERE carrier = 'integer_partition') $q$),
  ('glyphs','exactly one is_default row per carrier that has any base_glyph rows at all','eq','true','the flag names which kind the 1-arg overload draws',$q$
    SELECT bool_and(n = 1)::text FROM (SELECT carrier, count(*) FILTER (WHERE is_default) AS n FROM base_glyph GROUP BY carrier) t $q$),
  ('glyphs','the default row''s kind matches what the 1-arg overload actually draws, for both carriers touched here','eq','matrix|ferrers','base_glyph.is_default is DATA — this checks it against the real function, not the other way round',$q$
    SELECT (SELECT kind FROM base_glyph WHERE carrier = 'permutation' AND is_default)
        || '|' || (SELECT kind FROM base_glyph WHERE carrier = 'integer_partition' AND is_default) $q$),
  ('glyphs','carrier_renders_svg is still true for both carriers (the 1-arg overload alone drives it, unaffected by the 2-arg addition)','eq','true|true','carrier_renders_svg only looks at proargtypes[0]',$q$
    SELECT carrier_renders_svg('permutation')::text || '|' || carrier_renders_svg('integer_partition')::text $q$),
  ('glyphs','an unknown kind falls back to the default picture rather than erroring','eq','true|true','ELSE branch of both dispatchers',$q$
    SELECT (glyph_svg(ROW(ARRAY[2,4,1,3])::permutation, 'nonsense') = glyph_svg(ROW(ARRAY[2,4,1,3])::permutation))::text
        || '|' || (glyph_svg(ROW(ARRAY[3,1])::integer_partition, 'nonsense') = glyph_svg(ROW(ARRAY[3,1])::integer_partition))::text $q$);
