-- requires: realizer, set_compositions
-- fubini_numbers — the ordered Bell / Fubini numbers a(n) = 1,1,3,13,75,541,… (OEIS A000670), an UNGRADED / infinite
-- collection (carrier numeric) like catalan_numbers/bell_numbers. a(n) counts ordered set partitions of [n] (set
-- rankings with ties). This is the ROW-SUM sequence of the surjection triangle T(n,k) = k!·S(n,k): Σ_k k!·S(n,k) =
-- a(n), so cardinality(surjections_onto_k(n)) = a(n) — the alias identity asserted in triangle_slices. The floor
-- REUSES set_compositions' fubini(n) (a(n) via the binomial-convolution recurrence a(n) = Σ_k C(n,k)·a(n−k)) — the
-- same identity in its fiber-count role there. That the recurrence and the summed k!·S(n,k) agree is a genuine
-- accelerated-vs-naive oracle (two independent computations), not a tautology.

CREATE TYPE fubini_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f fubini_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT fubini(r) FROM generate_series(0, element_limit - 1) r $$;                      -- rank r (0-based) → a(r)
-- membership via the generic monotonic-scan contains synthesized from fiber_unrank (non-decreasing sequence)

-- direct unrank (capability layer 3): the ord-th term IS a(ord).
CREATE FUNCTION fiber_unrank(f fubini_numbers_fiber, rank rank_index) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT fubini(rank::int) $$;
INSERT INTO base_collection VALUES ('fubini_numbers', 'numeric', true);                         -- unbounded, ungraded
INSERT INTO base_monotonic_sequence VALUES ('fubini_numbers');   -- non-decreasing: synth a scanning contains
SELECT base_realize('fubini_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('fubini_numbers','first terms via the realized floor','eq','1,1,3,13,75,541,4683,47293','elements over the one infinite fiber (n=0..7)',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(fubini_numbers(), 8) e $q$),
  ('fubini_numbers','ungraded ⇒ one fiber with empty address','eq','1|{}','fibers(handle)',$q$
    SELECT count(*)::text || '|' || (SELECT fiber_address(f)::text FROM fibers(fubini_numbers()) f LIMIT 1) FROM fibers(fubini_numbers()) $q$),
  ('fubini_numbers','unrank(5) = 541','eq','541','rank 5 (0-based)',$q$
    SELECT (unrank(fubini_numbers(), 5)).value::text $q$),
  ('fubini_numbers','cardinality = infinity (unbounded)','eq','Infinity','one endless fiber',$q$
    SELECT cardinality(fubini_numbers())::text $q$),
  ('fubini_numbers','contains is rank-agnostic: 75 ∈, 100 ∉ (via <@)','eq','true|false','generated contains + operator',$q$
    SELECT (75::numeric <@ fubini_numbers())::text || '|' || (100::numeric <@ fubini_numbers())::text $q$);
-- the surjections_onto_k row-sum cross-check (a(n) = Σ_k k!·S(n,k)) moved to
-- packs/permutations-plus/triangle_slices.permutations-plus.sql — surjections_onto_k is a permutations-plus
-- collection, #283 phase 3 (same pattern as motzkin_numbers dropping its motzkin_paths cross-check to `paths`).
