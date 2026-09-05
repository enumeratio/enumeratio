-- requires: realizer
-- requires-tag: collection
-- Page-space glyph registry: which SVG glyph KIND each carrier casts into (the client maps `kind` to a renderer).
-- Keyed by carrier, so every collection sharing it inherits the glyph for free — the page-space sibling of
-- base_polytope. A candidate home for richer per-space cast metadata later (see https://github.com/enumeratio/enumeratio/wiki/Visual-Representations).
INSERT INTO base_glyph (carrier, kind, title) VALUES
  ('integer_partition', 'ferrers', 'Ferrers diagram'),   -- rows of boxes, one per part
  ('dyck_path',         'path',    'lattice path'),       -- ±1 steps → a mountain range
  ('motzkin_path',      'path',    'lattice path'),       -- +1/0/−1 steps (level steps allowed)
  ('binary_word',       'cells',   'bit cells'),          -- a row of 0/1 cells
  ('finset',            'cells',   'indicator cells');    -- register over [n] (α=Fin n) or up to max member (α=ℕ)

-- ── SVG out of the db: glyph_svg(<carrier>) → a self-contained SVG string ────────────────────────────────────────
-- The "figures as data" slice (https://github.com/enumeratio/enumeratio/wiki/Render-Assets): pg emits the RENDER PAYLOAD, not just a `kind` for the
-- client to dispatch to a TS renderer. A generic web component can inject the returned string as-is. Theme-aware by
-- referencing the shared styling hooks (--enumeratio-accent / --enumeratio-border) with standalone fallbacks, so the
-- same SVG themes correctly wherever it lands. First carriers: the two 'path' glyphs (dyck, motzkin), sharing one
-- lattice-path generator (the SQL twin of the <lattice-path-glyph> element's geometry: +1 up / 0 level / −1 down,
-- filled under the walk). Ferrers/cells are the obvious next overloads.
CREATE FUNCTION lattice_path_svg(steps int[], unit numeric DEFAULT 18) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH pts AS (                                             -- the walk in page space, incl. the (0,0) origin
    SELECT 0 AS x, 0 AS y
    UNION ALL
    SELECT o::int, sum(step) OVER (ORDER BY o)::int
    FROM unnest(steps) WITH ORDINALITY AS t(step, o)
  ),
  dim AS (
    SELECT unit AS u,
           greatest(1, coalesce(array_length(steps, 1), 0)) AS len,
           greatest(1, (SELECT max(y) FROM pts))            AS maxh
  ),
  geo AS (
    SELECT len * u AS w, maxh * u AS h,
           (SELECT string_agg(format('%s,%s', x * u, (maxh - y) * u), ' ' ORDER BY x) FROM pts) AS poly
    FROM dim
  )
  -- args: 1=w+2 2=h+2 (viewBox) · 3=w 4=h (extent) · 5=poly (the walk points)
  SELECT format(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 %1$s %2$s" role="img" aria-label="lattice path">'
    '<line x1="0" y1="%4$s" x2="%3$s" y2="%4$s" stroke="var(--enumeratio-border,currentColor)" stroke-width="1" opacity="0.4"/>'
    '<polygon points="0,%4$s %5$s %3$s,%4$s" fill="color-mix(in srgb, var(--enumeratio-accent,#d97706) 16%%, transparent)"/>'
    '<polyline points="%5$s" fill="none" stroke="var(--enumeratio-accent,#d97706)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>'
    '</svg>',
    w + 2, h + 2, w, h, poly)
  FROM geo;
$$;
CREATE FUNCTION glyph_svg(p dyck_path)    RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT lattice_path_svg((p).steps) $$;
CREATE FUNCTION glyph_svg(p motzkin_path) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT lattice_path_svg((p).steps) $$;

-- ferrers: one row of boxes per part (the SQL twin of <ferrers-glyph>). parts descending; a box per cell.
CREATE FUNCTION ferrers_svg(parts int[], unit numeric DEFAULT 18) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH p AS (SELECT o AS r, part FROM unnest(parts) WITH ORDINALITY AS t(part, o)),
  cells AS (SELECT (c - 1) * unit AS x, (r - 1) * unit AS y FROM p, LATERAL generate_series(1, part) c),
  dim AS (SELECT greatest(1, coalesce(max(part), 0)) * unit AS w, greatest(1, count(*)) * unit AS h FROM p)
  SELECT format(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 %s %s" role="img" aria-label="Ferrers diagram">%s</svg>',
    (SELECT w FROM dim) + 2, (SELECT h FROM dim) + 2,
    (SELECT string_agg(format(
      '<rect x="%s" y="%s" width="%s" height="%s" rx="1.5" fill="color-mix(in srgb, var(--enumeratio-accent,#d97706) 16%%, transparent)" stroke="var(--enumeratio-accent,#d97706)" stroke-width="1"/>',
      x, y, unit, unit), '' ORDER BY y, x) FROM cells));
$$;
CREATE FUNCTION glyph_svg(p integer_partition) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT ferrers_svg((p).parts) $$;

-- cells: a row of 0/1 cells, filled where the bit is set, each labelled (the SQL twin of <cells-glyph>).
CREATE FUNCTION cells_svg(bits int[], unit numeric DEFAULT 22) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH b AS (SELECT o - 1 AS i, bit FROM unnest(bits) WITH ORDINALITY AS t(bit, o)),
  dim AS (SELECT greatest(1, count(*)) * unit AS w FROM b)
  SELECT format(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 %s %s" role="img" aria-label="binary word">%s</svg>',
    (SELECT w FROM dim) + 2, unit + 2,
    (SELECT string_agg(format(
      '<rect x="%1$s" y="0" width="%2$s" height="%2$s" rx="2" fill="%3$s" stroke="var(--enumeratio-border,currentColor)" stroke-width="1"/>'
      '<text x="%4$s" y="%5$s" text-anchor="middle" dominant-baseline="central" font-size="%6$s" fill="var(--enumeratio-text,currentColor)">%7$s</text>',
      i * unit, unit,
      CASE WHEN bit = 1 THEN 'color-mix(in srgb, var(--enumeratio-accent,#d97706) 55%, transparent)' ELSE 'transparent' END,
      i * unit + unit / 2, unit / 2, round(unit * 0.5, 2), bit), '' ORDER BY i) FROM b));
$$;
CREATE FUNCTION glyph_svg(p binary_word) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT cells_svg((p).bits) $$;

-- finset cells: the indicator register. Follows α (like notation): width = the ground n when finite (α = Fin n — the
-- register, carrier-pure, shared with binary_words), else up to the max member (α = ℕ — self-contained).
CREATE FUNCTION glyph_svg(s finset) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT cells_svg((SELECT coalesce(array_agg((i = ANY((s).members))::int ORDER BY i), ARRAY[]::int[])
                    FROM generate_series(1, coalesce((s).n, greatest(1, coalesce((SELECT max(x) FROM unnest((s).members) x), 0)))) i)) $$;

-- number line: a single dot on a horizontal line, positioned by sign and log-scaled magnitude (the SQL twin of a
-- sparkline). Lights up the ~81 numeric collections (carrier `numeric`, plus the `natural_number`/`integer_number`
-- domains) that share one scalar carrier and had zero glyph before this. Log-scaling (ln(1+|v|)) keeps fast-growing
-- sequences (factorials, Catalan numbers, …) legible — raw magnitude would pin everything past a few hundred to the
-- same pixel. `k` sets how quickly the dot approaches the edge; 6 puts small integers (0..20ish) across most of the
-- width while still leaving room for arbitrarily large values to keep moving right.
CREATE FUNCTION number_line_svg(value numeric, width numeric DEFAULT 84, height numeric DEFAULT 20, k numeric DEFAULT 6)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH v AS (
    SELECT coalesce(sign(value), 0) AS s, ln(1 + abs(coalesce(value, 0))) AS mag
  ),
  geo AS (
    SELECT width AS w, height AS h,
           height / 2 AS cy,
           (0.5 + 0.5 * (SELECT s FROM v) * (SELECT mag FROM v) / ((SELECT mag FROM v) + k)) * width AS cx
  )
  -- args: 1=w+2 2=h+2 (viewBox) · 3=cy (line y) · 4=w (line extent) · 5=w/2 (zero tick x) · 6=cx (dot x)
  -- round + trim_scale so whole-number coordinates print as "42", not "42.00000000000000000000"
  SELECT format(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 %1$s %2$s" role="img" aria-label="number line">'
    '<line x1="0" y1="%3$s" x2="%4$s" y2="%3$s" stroke="var(--enumeratio-border,currentColor)" stroke-width="1" opacity="0.4"/>'
    '<line x1="%5$s" y1="0" x2="%5$s" y2="%2$s" stroke="var(--enumeratio-border,currentColor)" stroke-width="1" opacity="0.25"/>'
    '<circle cx="%6$s" cy="%3$s" r="3.5" fill="var(--enumeratio-accent,#d97706)"/>'
    '</svg>',
    trim_scale(round(w + 2, 2)), trim_scale(round(h + 2, 2)), trim_scale(round(cy, 2)),
    trim_scale(round(w, 2)), trim_scale(round(w / 2, 2)), trim_scale(round(cx, 2)))
  FROM geo;
$$;
-- overloaded on `numeric` (the carrier for the bulk of the numeric collections, e.g. natural_numbers) and on the
-- `natural_number`/`integer_number` DOMAINS (the carrier for integer_numbers and any domain-typed axis value) —
-- domains resolve to their base type for most purposes, but pg_proc/pg_type keep them distinct, so
-- carrier_renders_svg(<domain name>) only derives true with an explicit overload per domain.
CREATE FUNCTION glyph_svg(v numeric)         RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT number_line_svg(v) $$;
CREATE FUNCTION glyph_svg(v natural_number)  RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT number_line_svg(v::numeric) $$;
CREATE FUNCTION glyph_svg(v integer_number)  RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT number_line_svg(v::numeric) $$;

-- sequence bar chart: one bar per term, height ∝ the term's value, growing up from a baseline, each labelled with
-- its value below the baseline. Hoisted here (#283 phase 3 — was ascent_sequence_glyph.sql, a words-plus file)
-- because it is shared by carriers spanning core (rgs_word) and multiple packs (words-plus's gray_code/
-- ternary_gray_code, permutations-plus's subexcedant_seq) — the ascent_sequence/gray_code/rgs_word/ternary_gray_code
-- /subexcedant_seq_glyph.sql files all still `-- requires: glyphs` and reuse it from here. terms int[] takes any
-- non-negative-small-integer array (ascents-so-far / subexcedant values / rgs letters / bits / ternary digits).
CREATE FUNCTION sequence_bar_svg(terms int[], unit numeric DEFAULT 18, unit_h numeric DEFAULT 10, label_h numeric DEFAULT 14)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH t AS (SELECT o - 1 AS i, term FROM unnest(terms) WITH ORDINALITY AS tt(term, o)),
  dim AS (SELECT greatest(1, count(*)) * unit AS w, greatest(1, coalesce(max(term), 0)) * unit_h AS h FROM t)
  -- args: 1=w+2 2=h+label_h+2 (viewBox) · 3=bars (rect grows up from baseline y=h, height=term*unit_h) + labels
  -- (value printed below the baseline, always legible even for a 0-height bar)
  SELECT format(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 %s %s" role="img" aria-label="sequence bar chart">%s</svg>',
    trim_scale(round((SELECT w FROM dim) + 2, 2)), trim_scale(round((SELECT h FROM dim) + label_h + 2, 2)),
    (SELECT string_agg(format(
      '<rect x="%1$s" y="%2$s" width="%3$s" height="%4$s" fill="color-mix(in srgb, var(--enumeratio-accent,#d97706) 55%%, transparent)" stroke="var(--enumeratio-accent,#d97706)" stroke-width="1"/>'
      '<text x="%5$s" y="%6$s" text-anchor="middle" dominant-baseline="hanging" font-size="%7$s" fill="var(--enumeratio-text,currentColor)">%8$s</text>',
      trim_scale(round(i * unit, 2)), trim_scale(round((SELECT h FROM dim) - term * unit_h, 2)),
      trim_scale(round(unit, 2)), trim_scale(round(term * unit_h, 2)),
      trim_scale(round(i * unit + unit / 2, 2)), trim_scale(round((SELECT h FROM dim) + 2, 2)),
      trim_scale(round(label_h * 0.7, 2)), term
    ), '' ORDER BY i) FROM t, dim));
$$;

-- permutation arc diagram: n points on a baseline, an arc bowing below from i to image[i] (a small tangent loop
-- for a fixed point instead of a degenerate zero-radius arc). Hoisted here (#283 phase 3 — was decorated_permutation_glyph
-- .sql, a permutations-plus file) because core's glyph_kinds.sql reuses it for the plain `permutation` carrier's
-- 'arc' kind, alongside packs/permutations-plus/decorated_permutation_glyph.sql, arrangement_glyph.sql and
-- affine_permutation_glyph.sql, which all still `-- requires: glyphs` and reuse it from here.
--   * image[i] = NULL ⇒ position i has no outgoing arc (arrangement's unused domain rows beyond its word length —
--     the sparse convention rook_placement_grid_svg already established for "no mark here").
--   * image[i] = i ⇒ a fixed point: drawn as a tangent loop, not a zero-radius arc.
--   * decorated[i] (default all false) ⇒ dashed stroke on that position's arc/loop, hollow ring on its point.
CREATE FUNCTION permutation_arc_svg(image int[], decorated boolean[] DEFAULT NULL, unit numeric DEFAULT 22)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH dim AS (SELECT greatest(1, coalesce(array_length(image, 1), 0)) AS n, unit * 0.16 AS pr, unit * 0.16 * 1.8 AS lr),
  pts AS (SELECT o AS i, (o - 1) * unit AS x, coalesce(decorated[o], false) AS dec
          FROM unnest(image) WITH ORDINALITY AS t(val, o)),
  arcs AS (SELECT (o - 1) * unit AS xa, (val - 1) * unit AS xb, coalesce(decorated[o], false) AS dec
           FROM unnest(image) WITH ORDINALITY AS t(val, o) WHERE val IS NOT NULL AND val <> o),
  loops AS (SELECT (o - 1) * unit AS x, coalesce(decorated[o], false) AS dec
            FROM unnest(image) WITH ORDINALITY AS t(val, o) WHERE val = o),
  geo AS (SELECT pr, greatest(n - 1, 0) * unit AS w,
          greatest(coalesce((SELECT max(abs(xb - xa)) / 2.0 FROM arcs), 0),
                   CASE WHEN EXISTS (SELECT 1 FROM loops) THEN 2 * lr ELSE 0 END) AS maxr
          FROM dim)
  -- args: 1,2=x0,y0 · 3,4=vw,vh (viewBox, padded by the point radius) · 5=arcs (semicircle, i→image[i], bowing
  -- below the baseline — dashed when decorated) · 6=loops (fixed points, tangent below the point — hollow+dashed
  -- when decorated) · 7=points (one dot per position, hollow when decorated[i])
  SELECT format(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="%1$s %2$s %3$s %4$s" role="img" aria-label="permutation arc diagram">%5$s%6$s%7$s</svg>',
    trim_scale(round(-(pr + 1), 2)), trim_scale(round(-(pr + 1), 2)),
    trim_scale(round(w + 2 * (pr + 1), 2)), trim_scale(round(maxr + 2 * (pr + 1), 2)),
    coalesce((SELECT string_agg(format(
      '<path d="M %s,0 A %s,%s 0 0,1 %s,0" fill="none" stroke="var(--enumeratio-accent,#d97706)" stroke-width="1.5"%s/>',
      trim_scale(round(least(xa, xb), 2)), trim_scale(round(abs(xb - xa) / 2.0, 2)), trim_scale(round(abs(xb - xa) / 2.0, 2)),
      trim_scale(round(greatest(xa, xb), 2)), CASE WHEN dec THEN ' stroke-dasharray="3,2"' ELSE '' END
    ), '' ORDER BY least(xa, xb)) FROM arcs), ''),
    coalesce((SELECT string_agg(format(
      '<circle cx="%s" cy="%s" r="%s" fill="none" stroke="var(--enumeratio-accent,#d97706)" stroke-width="1.5"%s/>',
      trim_scale(round(x, 2)), trim_scale(round((SELECT lr FROM dim), 2)), trim_scale(round((SELECT lr FROM dim), 2)),
      CASE WHEN dec THEN ' stroke-dasharray="2,1.5"' ELSE '' END
    ), '' ORDER BY x) FROM loops), ''),
    coalesce((SELECT string_agg(
      CASE WHEN dec THEN format('<circle cx="%s" cy="0" r="%s" fill="none" stroke="var(--enumeratio-text,currentColor)" stroke-width="2"/>',
                                 trim_scale(round(x, 2)), trim_scale(round((SELECT pr FROM dim), 2)))
           ELSE format('<circle cx="%s" cy="0" r="%s" fill="var(--enumeratio-text,currentColor)"/>',
                        trim_scale(round(x, 2)), trim_scale(round((SELECT pr FROM dim), 2))) END
    , '' ORDER BY i) FROM pts), '')
  ) FROM geo;
$$;

-- endofunction functional graph: n points evenly spaced on a circle (point i at angle 2π(i−1)/n, starting at 12
-- o'clock, clockwise), a straight chord with an arrowhead from i to images[i] for every non-fixed point, and a
-- small loop tangent to the circle (bulging outward, radially) for a fixed point i=images[i]. Hoisted here (#283
-- phase 3 — was endofunction_glyph.sql, a permutations-plus file) because core's glyph_kinds.sql reuses it for the
-- plain `permutation` carrier's 'cycle_diagram' kind (a permutation IS an endofunction, viewed as its own cycles),
-- alongside packs/permutations-plus/endofunction_glyph.sql, which still `-- requires: glyphs` and reuses it here.
CREATE FUNCTION endofunction_graph_svg(images int[], unit numeric DEFAULT 18, r numeric DEFAULT 3.5, loop_r numeric DEFAULT 7)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH dim AS (SELECT greatest(1, coalesce(array_length(images, 1), 0)) AS n),
  -- pg gotcha: cos/sin/pi/sqrt are double precision, and round(double precision, int) doesn't exist — do the
  -- trig in float8, then cast to numeric once (ux/uy) so every downstream round()/^ sees numeric, not double.
  geo AS (SELECT (greatest(24, unit::float8 * n / (2 * pi())))::numeric AS rad FROM dim),
  pts AS (
    SELECT o AS i, val,
           (rad::float8 * cos(2 * pi() * (o - 1) / n - pi() / 2))::numeric AS ux,   -- unit direction from center, point i
           (rad::float8 * sin(2 * pi() * (o - 1) / n - pi() / 2))::numeric AS uy
    FROM unnest(images) WITH ORDINALITY AS t(val, o), dim, geo
  ),
  arrows AS (
    SELECT p.i, p.ux AS xs, p.uy AS ys, q.ux AS xt, q.uy AS yt,
           sqrt((q.ux - p.ux) * (q.ux - p.ux) + (q.uy - p.uy) * (q.uy - p.uy)) AS len
    FROM pts p JOIN pts q ON q.i = p.val WHERE p.val <> p.i
  ),
  loops AS (SELECT i, ux, uy FROM pts WHERE val = i)
  -- args: 1,2=x0,y0 · 3,4=vw,vh (viewBox, centered on the circle, padded for loops+arrowheads) · 5=chords+
  -- arrowheads (i→images[i], straight lines through the circle interior) · 6=self-loops (fixed points, tangent
  -- outward) · 7=points (one dot per element, on the circle)
  SELECT format(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="%1$s %2$s %3$s %4$s" role="img" aria-label="functional graph">%5$s%6$s%7$s</svg>',
    trim_scale(round(-((SELECT rad FROM geo) + loop_r + r + 1), 2)), trim_scale(round(-((SELECT rad FROM geo) + loop_r + r + 1), 2)),
    trim_scale(round(2 * ((SELECT rad FROM geo) + loop_r + r + 1), 2)), trim_scale(round(2 * ((SELECT rad FROM geo) + loop_r + r + 1), 2)),
    coalesce((SELECT string_agg(
      format('<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="var(--enumeratio-accent,#d97706)" stroke-width="1.5"/>',
        trim_scale(round(xs, 2)), trim_scale(round(ys, 2)),
        trim_scale(round(xt - (xt - xs) / len * r, 2)), trim_scale(round(yt - (yt - ys) / len * r, 2))) ||
      format('<polygon points="%s,%s %s,%s %s,%s" fill="var(--enumeratio-accent,#d97706)"/>',
        trim_scale(round(xt - (xt - xs) / len * r, 2)), trim_scale(round(yt - (yt - ys) / len * r, 2)),
        trim_scale(round(xt - (xt - xs) / len * (r + 7) - (yt - ys) / len * 3, 2)), trim_scale(round(yt - (yt - ys) / len * (r + 7) + (xt - xs) / len * 3, 2)),
        trim_scale(round(xt - (xt - xs) / len * (r + 7) + (yt - ys) / len * 3, 2)), trim_scale(round(yt - (yt - ys) / len * (r + 7) - (xt - xs) / len * 3, 2)))
    , '' ORDER BY i) FROM arrows), ''),
    coalesce((SELECT string_agg(format(
      '<circle cx="%s" cy="%s" r="%s" fill="none" stroke="var(--enumeratio-accent,#d97706)" stroke-width="1.5"/>',
      trim_scale(round(ux * (1 + loop_r / (SELECT rad FROM geo)), 2)), trim_scale(round(uy * (1 + loop_r / (SELECT rad FROM geo)), 2)), trim_scale(round(loop_r, 2))
    ), '' ORDER BY i) FROM loops), ''),
    (SELECT string_agg(format(
      '<circle cx="%s" cy="%s" r="%s" fill="var(--enumeratio-text,currentColor)"/>',
      trim_scale(round(ux, 2)), trim_scale(round(uy, 2)), trim_scale(round(r, 2))
    ), '' ORDER BY i) FROM pts));
$$;

-- Which carriers have an SVG payload — DERIVED from the overloads, not a second registry to keep in sync: a new
-- glyph_svg(<carrier>) lights the carrier up automatically. The client reads this to decide when to ask for an SVG.
-- See https://github.com/enumeratio/enumeratio/wiki/Visual-Representations.
CREATE FUNCTION carrier_renders_svg(carrier_name text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_type t ON t.oid = p.proargtypes[0]
    WHERE p.proname = 'glyph_svg' AND t.typname = carrier_name)
$$;

-- Assert the GEOMETRY (the math the generator computes), not the styling — the styling hooks are slated to change
-- (render-assets), the coordinates are not. dyck_paths(2) rank 0 = UUDD ({1,1,-1,-1}); its walk peaks at height 2.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','glyph_svg emits a self-contained svg','eq','<svg…</svg>','pg renders the render payload, not just a kind',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg((unrank(dyck_paths(2),0)).value) g) s $q$),
  ('glyphs','lattice-path walk points (UUDD, unit 18)','eq','0,36 18,18 36,0 54,18 72,36','the polyline, page space',$q$
    SELECT substring(glyph_svg((unrank(dyck_paths(2),0)).value) FROM 'points="([0-9, ]+)" fill="none"') $q$),
  ('glyphs','lattice-path viewBox tracks length × height','eq','-1 -1 74 38','4 steps × peak 2, unit 18, +1 pad',$q$
    SELECT substring(glyph_svg((unrank(dyck_paths(2),0)).value) FROM 'viewBox="([^"]+)"') $q$),
  ('glyphs','glyph_svg is polymorphic over path carriers','eq','true','dyck + motzkin share lattice_path_svg',$q$
    SELECT (glyph_svg(ROW(ARRAY[1,-1])::dyck_path) = glyph_svg(ROW(ARRAY[1,-1])::motzkin_path))::text $q$),
  ('glyphs','carrier_renders_svg is derived from the overloads','eq','binary_word:t dyck_path:t finset:t integer_partition:t motzkin_path:t subset:f','no second registry; subset:f is the negative control — no glyph_svg(subset) type/overload. subsets ride the finset carrier (below), so they render there, not under a bare `subset` name',$q$
    SELECT string_agg(c || ':' || left(carrier_renders_svg(c)::text, 1), ' ' ORDER BY c)
    FROM unnest(ARRAY['dyck_path','motzkin_path','integer_partition','binary_word','finset','subset']) c $q$),
  -- A subset renders through its REAL carrier (finset), the exact path the client takes: glyph_svg((e).value). The
  -- finset value carries the fiber's ground n, so the register is fiber-aware for free — width = [n], members set.
  ('glyphs','a subset emits its length-n register via the finset carrier','eq','<svg…</svg>|3','glyph_svg((e).value); {1,2} ⊆ [3] ↦ a 3-cell register',$q$
    SELECT left(g,4) || '…' || right(g,6) || '|' || (length(g) - length(replace(g, '<rect', '')))/5
    FROM (SELECT glyph_svg((unrank(subsets(3),4)).value) g) s $q$),
  ('glyphs','finset glyph follows α: [4]-register (4 cells) vs ℕ self-contained (up to max=3)','eq','4|3','same carrier, n finite vs NULL',$q$
    SELECT (length(a) - length(replace(a, '<rect', '')))/5 || '|' || (length(b) - length(replace(b, '<rect', '')))/5
    FROM (SELECT glyph_svg(ROW(ARRAY[1,3], 4)::finset) a, glyph_svg(ROW(ARRAY[1,3], NULL::int)::finset) b) s $q$),
  ('glyphs','ferrers_svg box grid tracks parts (3+1, unit 18)','eq','-1 -1 56 38|4','cols=max part, rows=#parts; one box per cell',$q$
    SELECT substring(g FROM 'viewBox="([^"]+)"') || '|' || (length(g) - length(replace(g, '<rect', '')))/5
    FROM (SELECT ferrers_svg(ARRAY[3,1]) g) s $q$),
  ('glyphs','cells_svg one cell per bit (101, unit 22)','eq','-1 -1 68 24|3','width tracks length; a labelled box per bit',$q$
    SELECT substring(g FROM 'viewBox="([^"]+)"') || '|' || (length(g) - length(replace(g, '<rect', '')))/5
    FROM (SELECT cells_svg(ARRAY[1,0,1]) g) s $q$),
  ('glyphs','glyph_svg dispatches per carrier (ferrers/cells)','eq','true','integer_partition→ferrers, binary_word→cells',$q$
    SELECT (glyph_svg(ROW(ARRAY[3,1])::integer_partition) = ferrers_svg(ARRAY[3,1])
        AND glyph_svg(ROW(ARRAY[1,0,1])::binary_word) = cells_svg(ARRAY[1,0,1]))::text $q$),
  -- The numeric carrier (~81 collections, natural_numbers included) had zero glyph before number_line_svg — issue #144.
  ('glyphs','a natural number emits a self-contained number-line svg via glyph_svg','eq','<svg…</svg>','glyph_svg((e).value) on the numeric carrier',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg((unrank(natural_numbers(),7)).value) g) s $q$),
  ('glyphs','carrier_renders_svg is now true for the numeric carrier(s)','eq','integer_number:t natural_number:t numeric:t','glyph_svg overloaded on numeric + the natural_number/integer_number domains',$q$
    SELECT string_agg(c || ':' || left(carrier_renders_svg(c)::text, 1), ' ' ORDER BY c)
    FROM unnest(ARRAY['numeric','natural_number','integer_number']) c $q$),
  ('glyphs','number_line_svg centers zero at width/2 (default width 84)','eq','42','the zero tick and the dot for value 0 sit at the midpoint',$q$
    SELECT substring(number_line_svg(0) FROM 'cx="([0-9.]+)"') $q$),
  ('glyphs','number_line_svg pushes positive values right of center and negative left','eq','true|true','sign() drives which side of the zero tick the dot lands on',$q$
    SELECT (substring(number_line_svg(50) FROM 'cx="([0-9.]+)"')::numeric > 42)::text || '|' ||
           (substring(number_line_svg(-50) FROM 'cx="([0-9.]+)"')::numeric < 42)::text $q$),
  ('glyphs','number_line_svg log-scales magnitude: huge values keep moving but compress toward the edge','eq','true|true','ln(1+|v|) keeps fast-growing sequences (factorials, Catalan…) legible instead of pinning past a few hundred',$q$
    SELECT (substring(number_line_svg(10) FROM 'cx="([0-9.]+)"')::numeric < substring(number_line_svg(10000) FROM 'cx="([0-9.]+)"')::numeric)::text || '|' ||
           ((substring(number_line_svg(1000000) FROM 'cx="([0-9.]+)"')::numeric - substring(number_line_svg(10000) FROM 'cx="([0-9.]+)"')::numeric)
              < (substring(number_line_svg(100) FROM 'cx="([0-9.]+)"')::numeric - substring(number_line_svg(10) FROM 'cx="([0-9.]+)"')::numeric))::text $q$);

-- ── glyphs: the glyph PROTOTYPES as a collection ────────────────────────────────────────────────────────────────
-- The first INTERNAL (meta) collection — the library's own machinery surfaced as a browsable collection: its elements
-- are the distinct page-space glyph KINDS themselves (cells, ferrers, path). Ungraded (ng=0): one fixed fiber, no
-- size; the floor reads the base_glyph registry above. This is the descriptor-carrier pattern — elements() is a
-- SELECT over a catalog table, not a generated enumeration. See https://github.com/enumeratio/enumeratio/wiki/Visual-Representations.
CREATE TYPE glyph_kind AS (kind text, title text);
CREATE FUNCTION notation(g glyph_kind) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT (g).kind $$;
CREATE TYPE glyphs_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f glyphs_fiber, element_limit int) RETURNS SETOF glyph_kind LANGUAGE sql STABLE AS $$
  SELECT ROW(kind, title)::glyph_kind
  FROM (SELECT DISTINCT ON (kind) kind, title FROM base_glyph ORDER BY kind, carrier) s
  ORDER BY kind LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f glyphs_fiber) RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT count(DISTINCT kind)::numeric FROM base_glyph $$;
INSERT INTO base_collection VALUES ('glyphs', 'glyph_kind', false);   -- ng=0 (no base_grade), finite
-- membership is not a meaningful question here: this is an internal descriptor catalog (the glyph prototypes), not a
-- set defined by a predicate over a carrier domain. Recorded, so callers can tell this from a merely-unimplemented one.
INSERT INTO base_no_membership VALUES ('glyphs', 'internal descriptor catalog — membership is not a meaningful predicate over glyph_kind');
SELECT base_realize('glyphs');
INSERT INTO base_internal VALUES ('glyphs');                          -- an internal (non-mathematical) collection

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','the known prototypes are among the distinct kinds (a floor — a new carrier may add a kind)','eq','true','distinct page-space glyph kinds off the floor',$q$
    SELECT (array_agg(render(e)) @> ARRAY['cells','ferrers','path'])::text FROM elements(glyphs(), 100) e $q$),
  ('glyphs','cardinality = number of distinct kinds (a floor — more may be registered)','eq','true','one fixed fiber',$q$
    SELECT (cardinality(glyphs()) >= 3)::text $q$),
  ('glyphs','ungraded ⇒ one fiber with empty address','eq','1|{}','fibers(handle)',$q$
    SELECT count(*)::text || '|' || (SELECT fiber_address(f)::text FROM fibers(glyphs()) f LIMIT 1) FROM fibers(glyphs()) $q$),
  ('glyphs','deliberately not membership-bearing: recorded, and no contains synthesized','eq','recorded:t contains:f','an internal descriptor catalog, not a set with a membership predicate',$q$
    SELECT 'recorded:' || CASE WHEN EXISTS (SELECT 1 FROM base_no_membership WHERE collection='glyphs') THEN 't' ELSE 'f' END
        || ' contains:' || CASE WHEN to_regprocedure('contains(glyphs, glyph_kind)') IS NOT NULL THEN 't' ELSE 'f' END $q$);
