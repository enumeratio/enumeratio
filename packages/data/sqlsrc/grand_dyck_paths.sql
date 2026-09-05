-- requires: dyck_paths, realizer, utilities
-- grand_dyck_paths(n) — FREE ±1 paths of length 2n that end back at 0, with NO positivity constraint (the
-- path may dip below the axis). Reuses the dyck_path carrier (steps ±1) exactly — same alphabet, same notation
-- (U/D) — since dyck_paths IS the positivity-restricted sibling on the same carrier. Count = central binomial
-- coefficient C(2n,n): 1,2,6,20,70,252 for n=0..5.

CREATE TYPE grand_dyck_paths_fiber AS (n natural_number);
-- FLOOR: every ±1 word of length 2n summing to 0, in lex order (U<D; array DESC on the ±1 word).
CREATE FUNCTION fiber_elements(f grand_dyck_paths_fiber, element_limit int) RETURNS SETOF dyck_path LANGUAGE sql STABLE AS $$
  WITH RECURSIVE gen(steps, ups, len) AS (
      SELECT ARRAY[]::int[], 0, 0
    UNION ALL
      SELECT g.steps || c.step, g.ups + CASE WHEN c.step = 1 THEN 1 ELSE 0 END, g.len + 1
      FROM gen g CROSS JOIN (VALUES (1), (-1)) AS c(step)
      WHERE g.len < 2 * (f).n::int
        AND (c.step = -1 OR g.ups < (f).n::int)                 -- an up is allowed only while ups used < n
        AND (c.step = 1 OR (g.len - g.ups) < (f).n::int)        -- a down is allowed only while downs used < n
  )
  SELECT ROW(steps)::dyck_path FROM gen
  WHERE len = 2 * (f).n::int AND ups = (f).n::int
  ORDER BY steps DESC LIMIT element_limit $$;

CREATE FUNCTION fiber_count(f grand_dyck_paths_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT binomial(2 * (f).n::int, (f).n::int) $$;

-- contains: length 2n, steps ±1, exactly n ups (⇒ n downs, sum = 0) — no non-negativity requirement.
CREATE FUNCTION contains_in_fiber(f grand_dyck_paths_fiber, v dyck_path) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((v).steps, 1), 0) = 2 * (f).n::int
     AND NOT EXISTS (SELECT 1 FROM unnest((v).steps) s WHERE s NOT IN (1, -1))
     AND (SELECT count(*) FILTER (WHERE s = 1) FROM unnest((v).steps) s) = (f).n::int $$;

INSERT INTO base_collection VALUES ('grand_dyck_paths', 'dyck_path');
INSERT INTO base_grade VALUES ('grand_dyck_paths', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f grand_dyck_paths_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'GDyck(' || (f).n::int || ')' $$;
SELECT base_realize('grand_dyck_paths');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('grand_dyck_paths','cardinality anchor = C(2n,n) for n=0..5 (accel)','eq','1,2,6,20,70,252','the central binomial coefficients',$q$
    SELECT string_agg(cardinality(grand_dyck_paths(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('grand_dyck_paths','floor count matches the accel at n=3 (independent of the closed form)','eq','20','count via enumeration',$q$
    SELECT count(*)::text FROM elements(grand_dyck_paths(3)) e $q$),
  ('grand_dyck_paths','grand_dyck_paths(2) includes UDDU (dips below 0), which dyck_paths(2) excludes','eq','true|false','the free-path relaxation',$q$
    SELECT (ROW(ARRAY[1,-1,-1,1])::dyck_path <@ grand_dyck_paths(2))::text || '|' ||
           (ROW(ARRAY[1,-1,-1,1])::dyck_path <@ dyck_paths(2))::text $q$),
  ('grand_dyck_paths','dyck_paths(n) ⊆ grand_dyck_paths(n): every element of the restricted family also satisfies the free predicate','eq','true','positivity implies the free condition',$q$
    SELECT bool_and((e).value <@ grand_dyck_paths(4))::text FROM elements(dyck_paths(4)) e $q$),
  ('grand_dyck_paths','grand_dyck_paths(2) in lex order (U<D): 6 paths','eq','UUDD,UDUD,UDDU,DUUD,DUDU,DDUU','all ±1 words of length 4 summing to 0',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(grand_dyck_paths(2)) e $q$),
  ('grand_dyck_paths','every generated word sums to 0 and has length 2n (n=3)','eq','true','structural check',$q$
    SELECT bool_and(
        coalesce(array_length(((e).value).steps, 1), 0) = 6
        AND (SELECT sum(x) FROM unnest(((e).value).steps) x) = 0
      )::text FROM elements(grand_dyck_paths(3)) e $q$);
