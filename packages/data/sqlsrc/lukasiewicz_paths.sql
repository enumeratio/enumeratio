-- requires: dyck_paths, realizer
-- lukasiewicz_paths(n) — Łukasiewicz paths of length n+1: words s₁..s_{n+1} with each sᵢ ∈ {−1,0,1,2,…} (a
-- "down" step of exactly −1, or an "up" step of any size k≥0), every proper prefix sum ≥ 0, and the full sum
-- = −1. In bijection with plane trees of n edges via sᵢ = (children of the i-th node in preorder) − 1, so
-- cardinality(lukasiewicz_paths(n)) = Catalan(n) — same count as dyck_paths(n), on a genuinely different
-- carrier (the step alphabet is unbounded above, not ±1, so it does not fit the dyck_path carrier).

CREATE TYPE lukasiewicz_path AS (steps int[]);
CREATE FUNCTION notation(p lukasiewicz_path) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(string_agg(s::text, ',' ORDER BY o), '') FROM unnest((p).steps) WITH ORDINALITY AS t(s, o) $$;

CREATE TYPE lukasiewicz_paths_fiber AS (n natural_number);
-- FLOOR: build the length-(n+1) word left to right. At each position, a step st ∈ {−1,0,1,2,…} is admissible
-- iff the resulting partial sum still leaves enough remaining steps to reach the required total: for a
-- non-final step the new sum must stay ≥ 0 (only −1 steps can bring it back down, one at a time) AND ≤
-- remaining positions − 1 (so it CAN still be brought down to −1); the final step is unconstrained here and
-- filtered to sum = −1 at the end. Emitted in ascending step-value order (steps ASC ⇒ down before flatter
-- before taller, the natural order on the alphabet).
CREATE FUNCTION fiber_elements(f lukasiewicz_paths_fiber, element_limit int) RETURNS SETOF lukasiewicz_path LANGUAGE sql STABLE AS $$
  WITH RECURSIVE gen(steps, s, len) AS (
      SELECT ARRAY[]::int[], 0, 0
    UNION ALL
      SELECT g.steps || st, g.s + st, g.len + 1
      FROM gen g, LATERAL generate_series(
             -1,
             CASE WHEN g.len + 1 < (f).n::int + 1 THEN ((f).n::int + 1) - g.len - 2 - g.s ELSE -1 - g.s END
           ) AS st
      WHERE g.len < (f).n::int + 1
        AND (g.len + 1 = (f).n::int + 1 OR g.s + st >= 0)
  )
  SELECT ROW(steps)::lukasiewicz_path FROM gen
  WHERE len = (f).n::int + 1 AND s = -1
  ORDER BY steps ASC LIMIT element_limit $$;

CREATE FUNCTION fiber_count(f lukasiewicz_paths_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT catalan((f).n::int) $$;

-- contains: length n+1, every step ≥ −1, every proper prefix sum ≥ 0, and the full sum = −1.
CREATE FUNCTION contains_in_fiber(f lukasiewicz_paths_fiber, v lukasiewicz_path) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((v).steps, 1), 0) = (f).n::int + 1
     AND NOT EXISTS (SELECT 1 FROM unnest((v).steps) s WHERE s < -1)
     AND coalesce((SELECT sum(s) FROM unnest((v).steps) s), 0) = -1
     AND NOT EXISTS (SELECT 1 FROM (
           SELECT sum(s) OVER (ORDER BY o) AS pre, o, array_length((v).steps, 1) AS len
           FROM unnest((v).steps) WITH ORDINALITY AS t(s, o)) q
         WHERE q.o < q.len AND q.pre < 0) $$;

INSERT INTO base_collection VALUES ('lukasiewicz_paths', 'lukasiewicz_path');
INSERT INTO base_grade VALUES ('lukasiewicz_paths', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f lukasiewicz_paths_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Luk(' || (f).n::int || ')' $$;
SELECT base_realize('lukasiewicz_paths');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('lukasiewicz_paths','cardinality anchor = Catalan for n=0..5 (accel)','eq','1,1,2,5,14,42','same count as dyck_paths, different carrier',$q$
    SELECT string_agg(cardinality(lukasiewicz_paths(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('lukasiewicz_paths','floor count matches the accel for n=0..4 (independent of the closed form)','eq','true','enumeration cross-check',$q$
    SELECT bool_and(cardinality(lukasiewicz_paths(n)) = (SELECT count(*) FROM elements(lukasiewicz_paths(n))))::text
      FROM generate_series(0,4) n $q$),
  ('lukasiewicz_paths','n=0 ⇒ the single word (-1)','eq','1|-1','length-1 word, only −1 sums to −1',$q$
    SELECT count(*)::text || '|' || notation((unrank(lukasiewicz_paths(0), 0)).value) FROM elements(lukasiewicz_paths(0)) e $q$),
  ('lukasiewicz_paths','n=1 ⇒ the single word (0,-1)','eq','1|0,-1','length-2 word: s₁≥0 and s₁+s₂=-1 forces (0,-1)',$q$
    SELECT count(*)::text || '|' || notation((unrank(lukasiewicz_paths(1), 0)).value) FROM elements(lukasiewicz_paths(1)) e $q$),
  ('lukasiewicz_paths','n=2 words in ascending order: (0,0,-1),(1,-1,-1)','eq','0,0,-1|1,-1,-1','hand-verified length-3 words',$q$
    SELECT string_agg(notation((e).value), '|' ORDER BY ordinality(e)) FROM elements(lukasiewicz_paths(2)) e $q$),
  ('lukasiewicz_paths','every generated word has length n+1, proper prefixes ≥ 0, and sums to -1 (n=4)','eq','true','structural check',$q$
    SELECT bool_and((e).value <@ lukasiewicz_paths(4))::text FROM elements(lukasiewicz_paths(4)) e $q$),
  ('lukasiewicz_paths','contains via <@: (0,0,-1) ∈ lukasiewicz_paths(2); (-1,1,-1) ∉ (prefix dips to -1 despite the total also summing to -1)','eq','true|false','membership via the recorded predicate',$q$
    SELECT (ROW(ARRAY[0,0,-1])::lukasiewicz_path <@ lukasiewicz_paths(2))::text || '|' ||
           (ROW(ARRAY[-1,1,-1])::lukasiewicz_path <@ lukasiewicz_paths(2))::text $q$);
