-- requires: subexcedant_seqs, realizer, utilities
-- subexcedant_seqs statistics — a subexcedant sequence (a_1,…,a_n), 1 ≤ a_i ≤ i, is the standard "inversion table"
-- encoding of a permutation SHIFTED by one: c_i = i − a_i (0 ≤ c_i ≤ i−1) is the usual code, built by inserting i
-- into position a_i of the growing sequence — an insertion at a_i leaves (i − a_i) of the previously-placed larger
-- values after it, each an inversion. So `sum` = Σ(i − a_i) IS the inversion number of the corresponding
-- permutation (Mahonian-distributed — cf. FindStat St000018 on permutations), NOT the raw Σa_i. `zero_entries`
-- counts the positions where c_i = 0, i.e. a_i = i (i was inserted at the very end — no inversions contributed).

-- ── statistics (carrier: subexcedant_seq(terms int[]), terms[i] = a_i ∈ [1,i]) ─────────────────────────
-- sum: Σ(i − a_i) — the inversion number of the corresponding permutation.
CREATE FUNCTION subexcedant_sum(s subexcedant_seq) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(sum(i - (s).terms[i]), 0)::int FROM generate_subscripts((s).terms, 1) i $$;
-- zero_entries: positions where a_i = i (c_i = 0, no inversions contributed at that step).
CREATE FUNCTION subexcedant_zero_entries(s subexcedant_seq) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((s).terms, 1) i WHERE (s).terms[i] = i $$;

INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('subexcedant_seqs','sum','subexcedant_sum','Sum (inversions)','natural_numbers'),
  ('subexcedant_seqs','zero_entries','subexcedant_zero_entries','Zero entries','natural_numbers');

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
-- subexcedant_seqs(3) in lex order: (1,1,1),(1,1,2),(1,1,3),(1,2,1),(1,2,2),(1,2,3).
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('subexcedant_seqs','sum over subexcedant_seqs(3) in lex order is 3,2,1,2,1,0','eq','3,2,1,2,1,0','the Mahonian distribution: 0,1,1,2,2,3 as a multiset',$q$
    SELECT string_agg(subexcedant_sum((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(subexcedant_seqs(3)) e $q$),
  ('subexcedant_seqs','sum is Mahonian over subexcedant_seqs(3): distribution 1,2,2,1','eq','1,2,2,1','#sequences by inversion count 0,1,2,3',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT subexcedant_sum((e).value) k, count(*) c FROM elements(subexcedant_seqs(3)) e GROUP BY 1) t(k,c) $q$),
  ('subexcedant_seqs','zero_entries over subexcedant_seqs(3) in lex order is 1,1,2,2,2,3','eq','1,1,2,2,2,3','a_i = i counts',$q$
    SELECT string_agg(subexcedant_zero_entries((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(subexcedant_seqs(3)) e $q$),
  ('subexcedant_seqs','the lex-last sequence (1,2,3) has sum 0 and zero_entries 3 — the identity permutation','eq','0|3','a_i = i everywhere ⇒ no inversions',$q$
    SELECT subexcedant_sum(ROW(ARRAY[1,2,3])::subexcedant_seq)::text || '|' ||
           subexcedant_zero_entries(ROW(ARRAY[1,2,3])::subexcedant_seq)::text $q$),
  ('subexcedant_seqs','the lex-first sequence (1,1,1) has sum 3 (max) — the fully reversed permutation','eq','3','C(3,2) = 3, the maximum inversion count at n=3',$q$
    SELECT subexcedant_sum(ROW(ARRAY[1,1,1])::subexcedant_seq)::text $q$),
  ('subexcedant_seqs','empty sequence (n=0): sum=0, zero_entries=0','eq','0|0','edge case, no terms',$q$
    SELECT subexcedant_sum((unrank(subexcedant_seqs(0),0)).value)::text || '|' ||
           subexcedant_zero_entries((unrank(subexcedant_seqs(0),0)).value)::text $q$);
