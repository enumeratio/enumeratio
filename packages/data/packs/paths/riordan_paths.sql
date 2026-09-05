-- requires: motzkin_paths, realizer
-- riordan_paths — ported from pg-enumeratio-core_old_backup/sqlsrc/riordan-paths.sql. Riordan(n) paths: Motzkin
-- paths (steps U=+1, L=0 flat, D=-1) of length n with NO flat step at height 0. A base_restrict of motzkin_paths:
-- reuses the motzkin_path carrier + notation as-is; contributes only the defining predicate. Height never goes
-- negative and D at height 0 would do exactly that, so it's already excluded by the parent floor — the only
-- extra restriction here is banning L at height 0.
-- |riordan_paths(n)| = Riordan(n), A005043: 1, 0, 1, 1, 3, 6, 15, 36, 91, 232, …

-- ── the defining predicate ───────────────────────────────────────────────────────────────────────────
CREATE FUNCTION is_riordan_path(mp motzkin_path) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE h int := 0; s int;
  BEGIN
    FOREACH s IN ARRAY coalesce((mp).steps, '{}'::int[]) LOOP
      IF s = 0 AND h = 0 THEN RETURN false; END IF;   -- flat step forbidden at height 0
      h := h + s;
    END LOOP;
    RETURN true;
  END
$$;

SELECT base_restrict('riordan_paths', 'motzkin_paths', 'is_riordan_path');

CREATE FUNCTION fiber_symbol(f riordan_paths_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Rior(' || (f).n::int || ')' $$;   -- corpus symbol

SELECT wire_set_notation('riordan_paths');

-- ── examples ─────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES

  ('riordan_paths', 'the A005043 prefix, n = 0..9', 'eq', '1 0 1 1 3 6 15 36 91 232', 'Riordan numbers via the restricted floor count.', $q$
    SELECT string_agg(cardinality(riordan_paths(n))::text, ' ' ORDER BY n)
    FROM generate_series(0, 9) n
  $q$),

  ('riordan_paths', 'riordan_paths(4) count = 3', 'eq', '3', 'Riordan(4) = 3 (A005043).', $q$
    SELECT cardinality(riordan_paths(4))::text
  $q$),

  ('riordan_paths', 'riordan_paths(6) count = 15', 'eq', '15', 'Riordan(6) = 15 (A005043).', $q$
    SELECT cardinality(riordan_paths(6))::text
  $q$),

  ('riordan_paths', 'the 3 Riordan paths of length 4, in the collection''s own order', 'eq', 'UDUD ULLD UUDD',
   'the motzkin floor''s ascending-step (D<L<U) order, filtered — none carries a flat step at height 0.', $q$
    SELECT string_agg(notation((e).value), ' ' ORDER BY ordinality(e))
    FROM elements(riordan_paths(4)) e
  $q$),

  ('riordan_paths', 'every element of riordan_paths(6) is is_riordan_path', 'ok', NULL,
   'no flat step at height 0, for the whole fiber.', $q$
    DO $$ DECLARE e record; BEGIN
      FOR e IN SELECT (v).value AS val FROM elements(riordan_paths(6)) v LOOP
        ASSERT is_riordan_path(e.val), 'not riordan';
      END LOOP;
    END $$
  $q$),

  ('riordan_paths', 'no flat step sits at height 0, checked prefix-by-prefix', 'ok', NULL,
   'the defining restriction, re-derived directly over the fiber (not just via the predicate).', $q$
    DO $$ DECLARE e record; s int[]; h int; i int; BEGIN
      FOR e IN SELECT (v).value AS val FROM elements(riordan_paths(6)) v LOOP
        s := (e.val).steps; h := 0;
        FOREACH i IN ARRAY s LOOP
          ASSERT NOT (i = 0 AND h = 0), 'flat step at height 0';
          h := h + i;
        END LOOP;
        ASSERT h = 0, 'unbalanced';
      END LOOP;
    END $$
  $q$),

  ('riordan_paths', 'contains via <@: UD in riordan_paths(2), LL not (flat at height 0)', 'eq', 'true|false',
   'derived membership = parent-contains AND is_riordan_path.', $q$
    SELECT (ROW(ARRAY[1,-1])::motzkin_path <@ riordan_paths(2))::text || '|' ||
           (ROW(ARRAY[0,0])::motzkin_path <@ riordan_paths(2))::text
  $q$),

  ('riordan_paths', 'elements() iterates the fiber: riordan_paths(7) has 36', 'eq', '36', 'Riordan(7) = 36.', $q$
    SELECT count(*)::text FROM elements(riordan_paths(7))
  $q$);
