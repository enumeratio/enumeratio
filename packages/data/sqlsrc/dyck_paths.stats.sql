-- requires: dyck_paths, realizer, utilities
-- dyck_paths statistics & maps — more classic Dyck-word invariants beyond peaks/height/area: returns to 0
-- (touch-downs), valleys (DU factors), double rises (UU factors), and the longest ascending run. Valleys and
-- double rises are each Narayana-distributed (valleys = peaks − 1). REVERSE-COMPLEMENT (reverse the word and
-- negate every step) is a Dyck-path involution — it lands back in dyck_paths on the same fiber.

-- ── statistics (carrier: dyck_path(steps int[]) of ±1) ──────────────────────────────────────────────────
-- returns to 0: number of steps at which the running height is back on the axis (each maximal arch ends in one).
CREATE FUNCTION dyck_returns(d dyck_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM (SELECT sum(s) OVER (ORDER BY o) h
    FROM unnest((d).steps) WITH ORDINALITY AS t(s, o)) q WHERE h = 0 $$;
-- valleys: a down immediately followed by an up (a DU factor). Equals peaks − 1; Narayana-distributed.
CREATE FUNCTION dyck_valleys(d dyck_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((d).steps, 1) i
   WHERE i < array_length((d).steps, 1) AND (d).steps[i] = -1 AND (d).steps[i+1] = 1 $$;
-- double rises: an up immediately followed by an up (a UU factor). Also Narayana-distributed.
CREATE FUNCTION dyck_double_rises(d dyck_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((d).steps, 1) i
   WHERE i < array_length((d).steps, 1) AND (d).steps[i] = 1 AND (d).steps[i+1] = 1 $$;
-- longest ascent: the length of the longest maximal run of consecutive up-steps (islands of +1).
CREATE FUNCTION dyck_longest_ascent(d dyck_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(max(cnt), 0)::int FROM (
    SELECT count(*) cnt FROM (
      SELECT o - row_number() OVER (ORDER BY o) AS g
      FROM unnest((d).steps) WITH ORDINALITY AS t(s, o) WHERE s = 1) z
    GROUP BY g) q $$;

-- ── map → dyck_paths ────────────────────────────────────────────────────────────────────────────────────
-- reverse-complement: read the word right-to-left and negate every step, w'(i) = −w(2n+1−i). A Dyck path stays a
-- Dyck path (an involution on each fiber): it swaps ups↔downs of the mirrored word.
CREATE FUNCTION dyck_reverse_complement(d dyck_path) RETURNS dyck_path LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(SELECT -(d).steps[array_length((d).steps, 1) + 1 - i]
                   FROM generate_subscripts((d).steps, 1) i))::dyck_path $$;

-- ── register in base_stat / base_map ────────────────────────────────────────────────────────────────────
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('dyck_paths','returns','dyck_returns','Number of returns','natural_numbers'),
  ('dyck_paths','valleys','dyck_valleys','Number of valleys','natural_numbers'),
  ('dyck_paths','double_rises','dyck_double_rises','Number of double rises','natural_numbers'),
  ('dyck_paths','longest_ascent','dyck_longest_ascent','Longest ascent','natural_numbers');

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('dyck_paths','reverse_complement','dyck_reverse_complement','dyck_paths','Reverse-complement',NULL);

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
-- dyck_paths(3) in rank order: UUUDDD,UUDUDD,UUDDUD,UDUUDD,UDUDUD; dyck_paths(4) has 14 paths.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('dyck_paths','returns: UUDD=1, UDUD=2, UDUUDD=2','eq','1|2|2','touch-downs to the axis',$q$
    SELECT dyck_returns(ROW(ARRAY[1,1,-1,-1])::dyck_path)::text || '|' ||
           dyck_returns(ROW(ARRAY[1,-1,1,-1])::dyck_path)::text || '|' ||
           dyck_returns(ROW(ARRAY[1,-1,1,1,-1,-1])::dyck_path)::text $q$),
  ('dyck_paths','returns distribution over dyck_paths(4) is 5,5,3,1','eq','5,5,3,1','#paths with 1,2,3,4 returns',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT dyck_returns((e).value) k, count(*) c FROM elements(dyck_paths(4)) e GROUP BY 1) t(k,c) $q$),
  ('dyck_paths','valleys is Narayana over dyck_paths(3): distribution 1,3,1','eq','1,3,1','#valleys = 0,1,2 ⇒ N(3,k)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT dyck_valleys((e).value) k, count(*) c FROM elements(dyck_paths(3)) e GROUP BY 1) t(k,c) $q$),
  ('dyck_paths','valleys is Narayana over dyck_paths(4): distribution 1,6,6,1','eq','1,6,6,1','N(4,k)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT dyck_valleys((e).value) k, count(*) c FROM elements(dyck_paths(4)) e GROUP BY 1) t(k,c) $q$),
  ('dyck_paths','double rises is Narayana over dyck_paths(4): distribution 1,6,6,1','eq','1,6,6,1','#UU factors ⇒ N(4,k)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT dyck_double_rises((e).value) k, count(*) c FROM elements(dyck_paths(4)) e GROUP BY 1) t(k,c) $q$),
  ('dyck_paths','double rises: UUUDDD=2, UDUD=0, UUDD=1','eq','2|0|1','count of UU factors',$q$
    SELECT dyck_double_rises(ROW(ARRAY[1,1,1,-1,-1,-1])::dyck_path)::text || '|' ||
           dyck_double_rises(ROW(ARRAY[1,-1,1,-1])::dyck_path)::text || '|' ||
           dyck_double_rises(ROW(ARRAY[1,1,-1,-1])::dyck_path)::text $q$),
  ('dyck_paths','longest ascent over dyck_paths(3) in rank order is 3,2,2,2,1','eq','3,2,2,2,1','longest run of U per path',$q$
    SELECT string_agg(dyck_longest_ascent((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(dyck_paths(3)) e $q$),
  ('dyck_paths','longest ascent sums to 33 over dyck_paths(4)','eq','33','Σ longest-U-run over the 14 paths',$q$
    SELECT sum(dyck_longest_ascent((e).value))::text FROM elements(dyck_paths(4)) e $q$),
  ('dyck_paths','empty path (n=0): every stat is 0','eq','0|0|0|0','edge case, no steps',$q$
    SELECT dyck_returns((unrank(dyck_paths(0),0)).value)::text || '|' ||
           dyck_valleys((unrank(dyck_paths(0),0)).value)::text || '|' ||
           dyck_double_rises((unrank(dyck_paths(0),0)).value)::text || '|' ||
           dyck_longest_ascent((unrank(dyck_paths(0),0)).value)::text $q$),
  ('dyck_paths','reverse-complement: UDUUDD ↦ UUDDUD; UUDD and UDUD are fixed','eq','UUDDUD|UUDD|UDUD','mirror-and-negate',$q$
    SELECT notation(dyck_reverse_complement(ROW(ARRAY[1,-1,1,1,-1,-1])::dyck_path)) || '|' ||
           notation(dyck_reverse_complement(ROW(ARRAY[1,1,-1,-1])::dyck_path)) || '|' ||
           notation(dyck_reverse_complement(ROW(ARRAY[1,-1,1,-1])::dyck_path)) $q$),
  ('dyck_paths','reverse-complement over dyck_paths(3) in rank order','eq','UUUDDD,UUDUDD,UDUUDD,UUDDUD,UDUDUD','image of each of the 5 paths',$q$
    SELECT string_agg(notation(dyck_reverse_complement((e).value)), ',' ORDER BY ordinality(e)) FROM elements(dyck_paths(3)) e $q$),
  ('dyck_paths','reverse-complement is an involution on dyck_paths(4)','eq','true','applying it twice is the identity',$q$
    SELECT bool_and(((dyck_reverse_complement(dyck_reverse_complement((e).value))).steps) = ((e).value).steps)::text
      FROM elements(dyck_paths(4)) e $q$),
  ('dyck_paths','reverse-complement image renders in the codomain (dyck_paths) form','eq','UUDDUD','render_value on a dyck_path image',$q$
    SELECT render_value(dyck_reverse_complement(ROW(ARRAY[1,-1,1,1,-1,-1])::dyck_path)) $q$);

-- ── the q,t-Catalan pair + the dual of longest ascent ────────────────────────────────────────────────────
-- BOUNCE (Haglund). The bounce path starts at (0,0) and repeats: travel north (fixed x) until reaching the
-- WEST END of an east step of d, turn east until landing back on the diagonal at (s',s'). The bounce stops at
-- 0 = s_0 < s_1 < ⋯ < s_b = n; bounce = Σ_{i≥1} (n − s_i). Lattice form: up = north (0,1), down = east (1,0),
-- so after i steps the point is (x,y) = (#downs, #ups) and the Dyck height is y−x. An east step ending step i
-- has west end (c−1, c+h) with c = #downs in the first i steps and h = height after step i.

CREATE FUNCTION dyck_bounce(d dyck_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  WITH RECURSIVE
  e(x, y) AS (                                   -- west ends of d's east steps
    SELECT (c - 1)::int, (c + h)::int FROM (
      SELECT s, count(*) FILTER (WHERE s = -1) OVER (ORDER BY o) AS c,
             sum(s) OVER (ORDER BY o) AS h
      FROM unnest((d).steps) WITH ORDINALITY AS t(s, o)) q
    WHERE s = -1),
  b(s) AS (                                      -- diagonal hit-points 0 = s_0 < s_1 < ⋯ < n
    SELECT 0
    UNION ALL
    SELECT e.y FROM b JOIN e ON e.x = b.s              -- lowest east-step west end above (s,s)
    WHERE NOT EXISTS (SELECT 1 FROM e e2 WHERE e2.x = b.s AND e2.y < e.y))
  SELECT coalesce(sum((array_length((d).steps,1)/2)::int - s), 0)::int FROM b WHERE s > 0 $$;

-- DINV. For each up step let a_i = height just before it (#full squares in its row between path and diagonal).
-- dinv = #{i < j : a_i = a_j} + #{i < j : a_i = a_j + 1}. The pair (area, dinv) is the classic q,t-Catalan
-- grading; (area, bounce) is equidistributed with it.

CREATE FUNCTION dyck_dinv(d dyck_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  WITH a AS (
    SELECT row_number() OVER (ORDER BY o) - 1 AS i,         -- up-step index, 0-based
           h - 1 AS hb                                      -- height before this up step
    FROM (SELECT o, s, sum(s) OVER (ORDER BY o) AS h
          FROM unnest((d).steps) WITH ORDINALITY AS t(s, o)) q
    WHERE s = 1)
  SELECT count(*)::int FROM a x JOIN a y ON x.i < y.i AND x.hb - y.hb IN (0, 1) $$;

-- longest descent: the length of the longest maximal run of consecutive down-steps — mirrors dyck_longest_ascent
-- under reverse-complement.
CREATE FUNCTION dyck_longest_descent(d dyck_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(max(cnt), 0)::int FROM (
    SELECT count(*) cnt FROM (
      SELECT o - row_number() OVER (ORDER BY o) AS g
      FROM unnest((d).steps) WITH ORDINALITY AS t(s, o) WHERE s = -1) z
    GROUP BY g) q $$;

INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('dyck_paths','bounce','dyck_bounce','Bounce','natural_numbers'),
  ('dyck_paths','dinv','dyck_dinv','Dinv','natural_numbers'),
  ('dyck_paths','longest_descent','dyck_longest_descent','Longest descent','natural_numbers');

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
-- dyck_paths(3) in rank order: UUUDDD,UUDUDD,UUDDUD,UDUUDD,UDUDUD. Hand-checks:
--   bounce: 0,1,1,2,3     dinv: 0,1,2,1,3     longest descent: 3,2,2,2,1
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('dyck_paths','bounce over dyck_paths(3) in rank order is 0,1,1,2,3','eq','0,1,1,2,3','bounce path scores on the five paths',$q$
    SELECT string_agg(dyck_bounce((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(dyck_paths(3)) e $q$),
  ('dyck_paths','bounce distribution over dyck_paths(3) is 1,2,1,1','eq','1,2,1,1','#{paths by bounce} = the t-Catalan row',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT dyck_bounce((e).value) k, count(*) c FROM elements(dyck_paths(3)) e GROUP BY 1) t(k,c) $q$),
  ('dyck_paths','bounce is equidistributed with area over dyck_paths(4)','eq','true','the q,t-Catalan symmetry check at n=4',$q$
    SELECT (SELECT string_agg(c::text, ',' ORDER BY k)
              FROM (SELECT dyck_area((e).value) k, count(*) c FROM elements(dyck_paths(4)) e GROUP BY 1) a)
         = (SELECT string_agg(c::text, ',' ORDER BY k)
              FROM (SELECT dyck_bounce((e).value) k, count(*) c FROM elements(dyck_paths(4)) e GROUP BY 1) b)::text $q$),
  ('dyck_paths','bounce(UUDD)=0, bounce(UDUD)=1','eq','0|1','bounce path of UDUD hits the diagonal at 0,1,2',$q$
    SELECT dyck_bounce(ROW(ARRAY[1,1,-1,-1])::dyck_path)::text || '|' ||
           dyck_bounce(ROW(ARRAY[1,-1,1,-1])::dyck_path)::text $q$),
  ('dyck_paths','dinv over dyck_paths(3) in rank order is 0,1,2,1,3','eq','0,1,2,1,3','arm-inversion pairs on the five paths',$q$
    SELECT string_agg(dyck_dinv((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(dyck_paths(3)) e $q$),
  ('dyck_paths','dinv is equidistributed with area over dyck_paths(4)','eq','true','area↔dinv: same multiset, n=4',$q$
    SELECT (SELECT string_agg(c::text, ',' ORDER BY k)
              FROM (SELECT dyck_area((e).value) k, count(*) c FROM elements(dyck_paths(4)) e GROUP BY 1) a)
         = (SELECT string_agg(c::text, ',' ORDER BY k)
              FROM (SELECT dyck_dinv((e).value) k, count(*) c FROM elements(dyck_paths(4)) e GROUP BY 1) b)::text $q$),
  ('dyck_paths','dinv(UDUUDD)=1, dinv(UUDUDD)=1 (one qualifying pair each)','eq','1|1','a = (0,0,1) and (0,1,1) row vectors',$q$
    SELECT dyck_dinv(ROW(ARRAY[1,-1,1,1,-1,-1])::dyck_path)::text || '|' ||
           dyck_dinv(ROW(ARRAY[1,1,-1,1,-1,-1])::dyck_path)::text $q$),
  ('dyck_paths','longest descent over dyck_paths(3) in rank order is 3,2,2,2,1','eq','3,2,2,2,1','longest run of D per path — mirrors longest ascent',$q$
    SELECT string_agg(dyck_longest_descent((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(dyck_paths(3)) e $q$),
  ('dyck_paths','longest descent = longest ascent ∘ reverse-complement over dyck_paths(4)','eq','true','the involution swaps U↔D runs',$q$
    SELECT bool_and(dyck_longest_descent((e).value) = dyck_longest_ascent(dyck_reverse_complement((e).value)))::text
      FROM elements(dyck_paths(4)) e $q$),
  ('dyck_paths','empty path (n=0): bounce, dinv, longest descent are all 0','eq','0|0|0','edge case, no steps',$q$
    SELECT dyck_bounce((unrank(dyck_paths(0),0)).value)::text || '|' ||
           dyck_dinv((unrank(dyck_paths(0),0)).value)::text || '|' ||
           dyck_longest_descent((unrank(dyck_paths(0),0)).value)::text $q$);
