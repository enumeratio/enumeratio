-- requires: integer_compositions, fibonacci, realizer
-- proper_compositions — ported from old-backup sqlsrc/proper-compositions.sql. Compositions of n into parts ≥ 2
-- (no 1-parts), the single part [n] included. base_restrict of integer_compositions: same carrier (composition)
-- + same single grade [n]; the floor filters the parent down to all-parts-≥2 compositions (realizer re-ranks);
-- contains = parent-contains AND predicate. |proper_compositions(n)| = c(n) with c(0)=1, c(1)=0,
-- c(n)=c(n−1)+c(n−2) — Fibonacci-shifted, c(n)=F(n−1) (A000045): 0,1,1,2,3,5,8,13,21,34 for n=1..10.

-- ── predicate ────────────────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION is_proper_composition(v composition) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(bool_and(p >= 2), true) FROM unnest((v).parts) p $$;   -- every part ≥ 2; empty ⇒ true (n=0)

-- accel hook (#172): c(n) = F(n−1) (A000045), reusing fibonacci.sql's fibonacci_term. fibonacci_term's loop
-- returns 1 for r=−1 (no iterations, seed b=1 stands) — exactly c(0)=1 — so no n=0 special case is needed.
CREATE FUNCTION proper_composition_count(f integer_compositions_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT fibonacci_term((f).n::int - 1) $$;

SELECT base_restrict('proper_compositions', 'integer_compositions', 'is_proper_composition', count_fn => 'proper_composition_count');

CREATE FUNCTION fiber_symbol(f proper_compositions_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'PCom(' || (f).n::int || ')' $$;   -- corpus symbol

SELECT wire_set_notation('proper_compositions');

-- ── examples ─────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES

  ('proper_compositions', '|proper_compositions(4)| = 2', 'eq', '2', '4 and 2+2.', $q$
    SELECT cardinality(proper_compositions(4))::text $q$),

  ('proper_compositions', '|proper_compositions(6)| = 5', 'eq', '5', '6, 4+2, 2+4, 3+3, 2+2+2.', $q$
    SELECT cardinality(proper_compositions(6))::text $q$),

  ('proper_compositions', 'count is Fibonacci-shifted c(n)=F(n−1) — A000045', 'eq', '0,1,1,2,3,5,8,13,21,34', 'n = 1..10, free from the restricted floor count.', $q$
    SELECT string_agg(cardinality(proper_compositions(n))::text, ',' ORDER BY n) FROM generate_series(1, 10) n $q$),

  ('proper_compositions', 'proper_compositions(6) enumerated (re-ranked parent order)', 'eq', '6,2+4,3+3,4+2,2+2+2', 'the filtered floor', $q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(proper_compositions(6)) e $q$),

  ('proper_compositions', 'every part of every composition of 8 is ≥ 2', 'eq', 'true', 'the defining invariant across the whole fiber', $q$
    SELECT bool_and(NOT EXISTS (SELECT 1 FROM unnest(((e).value).parts) p WHERE p < 2))::text FROM elements(proper_compositions(8)) e $q$),

  ('proper_compositions', 'every proper composition of 7 sums to 7', 'eq', 'true', 'the parent invariant survives the restriction', $q$
    SELECT bool_and((SELECT coalesce(sum(p), 0) FROM unnest(((e).value).parts) p) = 7)::text FROM elements(proper_compositions(7)) e $q$),

  ('proper_compositions', 'contains: 2+2 ∈ proper_compositions(4), 1+3 ∉ (via <@)', 'eq', 'true|false', 'derived membership = parent ∧ predicate', $q$
    SELECT (ROW(ARRAY[2,2])::composition <@ proper_compositions(4))::text || '|' ||
           (ROW(ARRAY[1,3])::composition <@ proper_compositions(4))::text $q$);
