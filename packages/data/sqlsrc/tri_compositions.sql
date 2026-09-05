-- requires: integer_compositions, realizer
-- tri_compositions — ported from old-backup sqlsrc/tri-compositions.sql. Compositions of n into parts from
-- {1,2,3} (ordered, order matters). |tri_compositions(n)| = the tribonacci count t(n)=t(n-1)+t(n-2)+t(n-3),
-- t(0)=1 — 1,1,2,4,7,13,24,44,81,149 (A000073 shifted). base_restrict of integer_compositions: same carrier
-- (composition) + single grade [n]; the floor filters the parent's gap-cut floor down to parts-in-{1,2,3}
-- compositions (realizer re-ranks); contains = parent-contains AND predicate.

-- ── predicate ────────────────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION is_tri_composition(v composition) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(bool_and(p BETWEEN 1 AND 3), true) FROM unnest((v).parts) p $$;   -- every part ∈ {1,2,3}

-- accel hook (#172): t(n)=t(n-1)+t(n-2)+t(n-3), t(0)=1 (a rolling 3-term recurrence, same style as fibonacci_term —
-- reused by tri_strings.sql, a {1,2,3}-composition in disguise via the run-length bijection).
CREATE FUNCTION tribonacci_composition_count(n int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE x numeric := 0; y numeric := 0; z numeric := 1; nxt numeric; i int; BEGIN   -- (x,y,z) = (t(i-3),t(i-2),t(i-1))
    IF n < 0 THEN RETURN 0; END IF;
    IF n = 0 THEN RETURN 1; END IF;
    FOR i IN 1..n LOOP nxt := x + y + z; x := y; y := z; z := nxt; END LOOP;
    RETURN z;
  END $$;
CREATE FUNCTION tri_composition_count(f integer_compositions_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT tribonacci_composition_count((f).n::int) $$;

SELECT base_restrict('tri_compositions', 'integer_compositions', 'is_tri_composition', count_fn => 'tri_composition_count');

CREATE FUNCTION fiber_symbol(f tri_compositions_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'TCom(' || (f).n::int || ')' $$;   -- corpus symbol

SELECT wire_set_notation('tri_compositions');

-- ── examples ─────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES

  ('tri_compositions', '|tri_compositions(4)| = 7', 'eq', '7', '1+1+1+1, 1+1+2, 1+2+1, 1+3, 2+1+1, 2+2, 3+1.', $q$
    SELECT cardinality(tri_compositions(4))::text $q$),

  ('tri_compositions', 'count is tribonacci t(n) — A000073 shifted', 'eq', '1,1,2,4,7,13,24,44,81,149', 'n = 0..9, free from the restricted floor count.', $q$
    SELECT string_agg(cardinality(tri_compositions(n))::text, ',' ORDER BY n) FROM generate_series(0, 9) n $q$),

  ('tri_compositions', 'tri_compositions(4) enumerated (re-ranked parent order)', 'eq', '1+3,2+2,1+1+2,3+1,1+2+1,2+1+1,1+1+1+1', 'the filtered floor', $q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(tri_compositions(4)) e $q$),

  ('tri_compositions', 'every part of every composition of 6 is in {1,2,3}', 'eq', 'true', 'the defining invariant across the whole fiber', $q$
    SELECT bool_and(NOT EXISTS (SELECT 1 FROM unnest(((e).value).parts) p WHERE p NOT BETWEEN 1 AND 3))::text FROM elements(tri_compositions(6)) e $q$),

  ('tri_compositions', 'every tri composition of 7 sums to 7', 'eq', 'true', 'the parent invariant survives the restriction', $q$
    SELECT bool_and((SELECT coalesce(sum(p), 0) FROM unnest(((e).value).parts) p) = 7)::text FROM elements(tri_compositions(7)) e $q$),

  ('tri_compositions', 'contains: 1+3 ∈ tri_compositions(4), 1+4 ∉ (via <@)', 'eq', 'true|false', 'derived membership = parent ∧ predicate', $q$
    SELECT (ROW(ARRAY[1,3])::composition <@ tri_compositions(4))::text || '|' ||
           (ROW(ARRAY[1,4])::composition <@ tri_compositions(4))::text $q$);
