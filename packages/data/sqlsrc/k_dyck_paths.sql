-- requires: realizer, utilities
-- k_dyck_paths — the k-ary Dyck paths (Fuss-Catalan): lattice paths with n up-steps of rise (k−1) and (k−1)·n
-- down-steps of fall 1, every prefix sum ≥ 0, ending at 0. Graded by (n, k). Count = the Fuss-Catalan number
-- C(kn, n)/((k−1)n+1): at k=2 the ordinary Dyck paths / Catalan (1,1,2,5,14,42); k=3 → 1,1,3,12,55,273; etc.
-- The k-ary generalisation of dyck_paths, counting k-ary trees with n internal nodes. Own step-word carrier.
CREATE TYPE k_dyck_path AS (steps int[]);                                  -- signed steps: +(k−1) = up, −1 = down
CREATE FUNCTION notation(p k_dyck_path) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(string_agg(CASE WHEN s > 0 THEN 'U' ELSE 'D' END, '' ORDER BY o), '') FROM unnest((p).steps) WITH ORDINALITY t(s, o) $$;

CREATE TYPE k_dyck_paths_fiber AS (n natural_number, k natural_number);   -- axes: n (up-steps), k (arity)
CREATE FUNCTION fiber_elements(f k_dyck_paths_fiber, element_limit int) RETURNS SETOF k_dyck_path LANGUAGE sql STABLE AS $$
  WITH RECURSIVE build(steps, h, ups, len) AS (
    SELECT ARRAY[]::int[], 0, 0, 0
    UNION ALL
    SELECT b.steps || s.val, b.h + s.val, b.ups + s.is_up, b.len + 1
    FROM build b, LATERAL (
      SELECT (f).k::int - 1 AS val, 1 AS is_up WHERE b.ups < (f).n::int                              -- an up-step
      UNION ALL
      SELECT -1, 0 WHERE (b.len - b.ups) < ((f).k::int - 1) * (f).n::int AND b.h >= 1                 -- a down-step (stay ≥ 0)
    ) s
    WHERE b.len < (f).k::int * (f).n::int
  )
  SELECT ROW(steps)::k_dyck_path FROM build WHERE len = (f).k::int * (f).n::int ORDER BY steps LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f k_dyck_paths_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT div(binomial((f).k::int * (f).n::int, (f).n::int)::numeric, ((f).k::int - 1) * (f).n::int + 1) $$;   -- Fuss-Catalan
CREATE FUNCTION contains_in_fiber(f k_dyck_paths_fiber, p k_dyck_path) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT (SELECT count(*) FILTER (WHERE s > 0) FROM unnest((p).steps) s) = (f).n::int                 -- exactly n up-steps
     AND coalesce(array_length((p).steps,1),0) = (f).k::int * (f).n::int                              -- length kn
     AND NOT EXISTS (SELECT 1 FROM (SELECT sum(s) OVER (ORDER BY o) h FROM unnest((p).steps) WITH ORDINALITY t(s,o)) q WHERE h < 0)
     AND coalesce((SELECT sum(s) FROM unnest((p).steps) s), 0) = 0 $$;

INSERT INTO base_collection VALUES ('k_dyck_paths', 'k_dyck_path');
INSERT INTO base_grade VALUES ('k_dyck_paths', 1, 'n', NULL, NULL), ('k_dyck_paths', 2, 'k', NULL, NULL);
CREATE FUNCTION fiber_symbol(f k_dyck_paths_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Dyck' || to_unicode_subscript((f).k) || '(' || (f).n::int || ')' $$;
SELECT base_realize('k_dyck_paths');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('k_dyck_paths','Fuss-Catalan: k=2 is Catalan, k=3 and k=4 the higher analogues (n=0..5)','eq','1,1,2,5,14,42|1,1,3,12,55,273|1,1,4,22,140,969','count = C(kn,n)/((k-1)n+1)',$q$
    SELECT concat_ws('|',
      (SELECT string_agg(cardinality(k_dyck_paths(n,2))::text, ',' ORDER BY n) FROM generate_series(0,5) n),
      (SELECT string_agg(cardinality(k_dyck_paths(n,3))::text, ',' ORDER BY n) FROM generate_series(0,5) n),
      (SELECT string_agg(cardinality(k_dyck_paths(n,4))::text, ',' ORDER BY n) FROM generate_series(0,5) n)) $q$),
  ('k_dyck_paths','k=2 matches the dedicated dyck_paths at n=4 (both Catalan C₄=14)','eq','14|14','the k=2 slice IS ordinary Dyck',$q$
    SELECT cardinality(k_dyck_paths(4,2))::text || '|' || cardinality(dyck_paths(4))::text $q$),
  ('k_dyck_paths','the 3 ternary Dyck paths of order 2 (k=3): U rises 2, D falls 1','eq','UDDUDD,UDUDDD,UUDDDD','prefix sums stay ≥ 0 (lex by step array)',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(k_dyck_paths(2,3)) e $q$),
  ('k_dyck_paths','contains via <@: UUDDDD ∈ k_dyck_paths(2,3), UDDDUD ∉ (dips below 0)','eq','true|false','the ballot condition',$q$
    SELECT (ROW(ARRAY[2,2,-1,-1,-1,-1])::k_dyck_path <@ k_dyck_paths(2,3))::text || '|' ||
           (ROW(ARRAY[2,-1,-1,-1,2,-1])::k_dyck_path <@ k_dyck_paths(2,3))::text $q$);
