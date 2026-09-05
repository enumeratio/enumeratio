-- requires: multisets, realizer, utilities
-- multisets statistics — distinct_elements and max_multiplicity, alongside the existing multiset_card (Multiset.card,
-- the WITH-multiplicity size, registered as an operation not a stat) and multiset_frequency (the exponential repr).

-- ── statistics (carrier: multiset(elements int[], n int)) ──────────────────────────────────────────────
-- distinct_elements: the number of distinct values present (ignoring multiplicity).
CREATE FUNCTION multiset_distinct_elements(m multiset) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(DISTINCT e)::int FROM unnest((m).elements) e $$;
-- max_multiplicity: the highest repetition count of any single value (0 for the empty multiset).
CREATE FUNCTION multiset_max_multiplicity(m multiset) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT max(c) FROM (SELECT count(*) c FROM unnest((m).elements) e GROUP BY e) t), 0)::int $$;

INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('multisets','distinct_elements','multiset_distinct_elements','Distinct elements','natural_numbers'),
  ('multisets','max_multiplicity','multiset_max_multiplicity','Maximum multiplicity','natural_numbers');

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
-- multisets(3,2) in rank order (from multisets.sql's own example): {1,1},{1,2},{2,2},{1,3},{2,3},{3,3}.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('multisets','distinct_elements over multisets(3,2) in rank order is 1,2,1,2,2,1','eq','1,2,1,2,2,1','doubled-element multisets have 1 distinct value',$q$
    SELECT string_agg(multiset_distinct_elements((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(multisets(3,2)) e $q$),
  ('multisets','max_multiplicity over multisets(3,2) in rank order is 2,1,2,1,1,2','eq','2,1,2,1,1,2','the complement of distinct_elements at k=2',$q$
    SELECT string_agg(multiset_max_multiplicity((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(multisets(3,2)) e $q$),
  ('multisets','distinct_elements(1,1,2,3) = 3, max_multiplicity(1,1,2,3) = 2','eq','3|2','one repeated value among four',$q$
    SELECT multiset_distinct_elements(ROW(ARRAY[1,1,2,3],3)::multiset)::text || '|' ||
           multiset_max_multiplicity(ROW(ARRAY[1,1,2,3],3)::multiset)::text $q$),
  ('multisets','distinct_elements never exceeds multiset_card, over multisets(4,3)','eq','true','distinct count ≤ total count with multiplicity',$q$
    SELECT bool_and(multiset_distinct_elements((e).value) <= multiset_card((e).value))::text
      FROM elements(multisets(4,3)) e $q$),
  ('multisets','the empty multiset (k=0): distinct_elements=0, max_multiplicity=0','eq','0|0','edge case, no elements',$q$
    SELECT multiset_distinct_elements((unrank(multisets(3,0),0)).value)::text || '|' ||
           multiset_max_multiplicity((unrank(multisets(3,0),0)).value)::text $q$);
