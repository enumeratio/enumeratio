-- requires: integer_compositions, fibonacci, realizer
-- odd_compositions — ported from old-backup sqlsrc/odd-compositions.sql. Compositions of n into positive ODD
-- parts {1,3,5,7,…} (ordered sums, order matters). base_restrict of integer_compositions: same carrier
-- (composition) + same single grade [n]; the floor filters the parent's floor down to all-odd-part
-- compositions (realizer re-ranks); contains = parent-contains AND predicate. |odd_compositions(n)| =
-- Fibonacci(n): 1,1,2,3,5,8,13,21,… (A000045) — free from the parent's exact count, no separate DP needed.

-- ── predicate ────────────────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION is_odd_composition(v composition) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (SELECT 1 FROM unnest((v).parts) p WHERE p % 2 = 0) $$;

-- accel hook (#172): |odd_compositions(n)| = F(n) (A000045) for n≥1; n=0 is the vacuous empty composition
-- (fibonacci_term(0)=0, so this genuinely needs the n=0 special case, unlike proper_compositions).
CREATE FUNCTION odd_composition_count(f integer_compositions_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN (f).n::int = 0 THEN 1::numeric ELSE fibonacci_term((f).n::int) END $$;

SELECT base_restrict('odd_compositions', 'integer_compositions', 'is_odd_composition', count_fn => 'odd_composition_count');

CREATE FUNCTION fiber_symbol(f odd_compositions_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'OCom(' || (f).n::int || ')' $$;   -- corpus symbol

SELECT wire_set_notation('odd_compositions');

-- ── examples ─────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES

  ('odd_compositions', '|odd_compositions(1)| = 1', 'eq', '1', 'Just "1".', $q$
    SELECT cardinality(odd_compositions(1))::text $q$),

  ('odd_compositions', '|odd_compositions(4)| = 3', 'eq', '3', '1+3, 3+1, 1+1+1+1.', $q$
    SELECT cardinality(odd_compositions(4))::text $q$),

  ('odd_compositions', '|odd_compositions(6)| = 8', 'eq', '8', 'Fibonacci(6).', $q$
    SELECT cardinality(odd_compositions(6))::text $q$),

  ('odd_compositions', 'count is Fibonacci(n) — A000045', 'eq', '1,1,2,3,5,8,13,21', 'n = 1..8, free from the restricted floor count.', $q$
    SELECT string_agg(cardinality(odd_compositions(n))::text, ',' ORDER BY n)
    FROM generate_series(1, 8) n $q$),

  ('odd_compositions', 'odd_compositions(4) enumerated', 'eq', '1+3,3+1,1+1+1+1', 'the filtered floor, in the re-ranked order', $q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(odd_compositions(4)) e $q$),

  ('odd_compositions', 'every part of every composition of 7 is odd', 'eq', 'true', 'the defining invariant across the whole fiber', $q$
    SELECT bool_and(NOT EXISTS (SELECT 1 FROM unnest(((e).value).parts) p WHERE p % 2 = 0))::text
    FROM elements(odd_compositions(7)) e $q$),

  ('odd_compositions', 'every odd composition of 8 sums to 8', 'eq', 'true', 'the parent invariant survives the restriction', $q$
    SELECT bool_and((SELECT coalesce(sum(p), 0) FROM unnest(((e).value).parts) p) = 8)::text
    FROM elements(odd_compositions(8)) e $q$),

  ('odd_compositions', 'contains: 1+3 ∈ odd_compositions(4), 2+2 ∉ (via <@)', 'eq', 'true|false', 'derived membership = parent ∧ predicate', $q$
    SELECT (ROW(ARRAY[1,3])::composition <@ odd_compositions(4))::text || '|' ||
           (ROW(ARRAY[2,2])::composition <@ odd_compositions(4))::text $q$);
