-- requires: subsets, realizer, utilities, integer_partitions
-- subsets — more statistics (span, gaps, odd/even counts) + a map to integer_partitions (members as distinct parts).

-- ── statistics (carrier: finset, members int[] sorted ascending) ─────────────────────────────────────────
CREATE FUNCTION subset_span(s finset) RETURNS int LANGUAGE sql IMMUTABLE AS $$      -- max − min; 0 for empty/singleton
  SELECT coalesce((s).members[array_length((s).members,1)] - (s).members[1], 0) $$;
CREATE FUNCTION subset_gaps(s finset) RETURNS int LANGUAGE sql IMMUTABLE AS $$      -- integers in (min,max) not in the set
  SELECT CASE WHEN array_length((s).members,1) IS NULL THEN 0
    ELSE ((s).members[array_length((s).members,1)] - (s).members[1] + 1) - array_length((s).members,1) END $$;
CREATE FUNCTION subset_odd_count(s finset) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM unnest((s).members) m WHERE m % 2 = 1 $$;
CREATE FUNCTION subset_even_count(s finset) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM unnest((s).members) m WHERE m % 2 = 0 $$;

-- ── map: members read largest-first as an integer partition (into distinct parts) ────────────────────────
CREATE FUNCTION subset_to_partition(s finset) RETURNS integer_partition LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(SELECT m FROM unnest((s).members) m ORDER BY m DESC))::integer_partition $$;

-- additive_energy — mathlib's Additive.Energy (Mathlib.Combinatorics.Additive.Energy), which we get to REUSE because
-- the finset carrier aligns with Lean's Finset. E⁺(A) = #{(a,b,c,d) ∈ A⁴ : a+b = c+d} = Σ_x r_A(x)², r_A(x) = #{(a,b)
-- : a+b = x}. Defined ONCE on `finset`, so it lands on EVERY α at once — subsets, k_subsets, boolean_algebra, simplex
-- (α = Fin n) AND finsets (α = ℕ) — and is α-agnostic (computed from the member values). (Multiplicative twin: backlog.)
CREATE FUNCTION additive_energy(s finset) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(sum(cnt * cnt), 0)
  FROM (SELECT count(*) cnt FROM unnest((s).members) a(m), unnest((s).members) b(m) GROUP BY a.m + b.m) t $$;
-- multiplicative_energy — mathlib's MulEnergy (the multiplicative twin): E×(A) = #{a·b = c·d} = Σ_x r×(x)². Same
-- definition with · for +; well-defined on our positive-integer members. (α with a multiplicative structure; Fin n
-- under × isn't a group, so the abstract story differs from the additive case — but on the member values it just works.)
CREATE FUNCTION multiplicative_energy(s finset) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(sum(cnt * cnt), 0)
  FROM (SELECT count(*) cnt FROM unnest((s).members) a(m), unnest((s).members) b(m) GROUP BY a.m * b.m) t $$;

-- ── register ────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('subsets','span','subset_span','Span','natural_numbers'),
  ('subsets','gaps','subset_gaps','Number of gaps','natural_numbers'),
  ('subsets','odd_elements','subset_odd_count','Number of odd elements','natural_numbers'),
  ('subsets','even_elements','subset_even_count','Number of even elements','natural_numbers'),
  ('subsets','additive_energy','additive_energy','Additive energy E⁺(A) = #{a+b=c+d}','natural_numbers'),
  ('subsets','multiplicative_energy','multiplicative_energy','Multiplicative energy E×(A) = #{a·b=c·d}','natural_numbers');
INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('subsets','to_partition','subset_to_partition','integer_partitions','To partition (distinct parts)',NULL);

-- ── examples (distributions derived independently in sage over Subsets(4)) ───────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('subsets','energies of {1,2,3,4}: additive E⁺ = 44, multiplicative E× = 32','eq','44|32','mathlib''s Additive.Energy / MulEnergy, on the finset carrier',$q$
    SELECT additive_energy(ROW(ARRAY[1,2,3,4], 4)::finset)::text || '|' || multiplicative_energy(ROW(ARRAY[1,2,3,4], 4)::finset)::text $q$),
  ('subsets','additive energy is α-AGNOSTIC (same over Fin n or ℕ)','eq','44|44','computed from the member values',$q$
    SELECT additive_energy(ROW(ARRAY[1,2,3,4], 4)::finset)::text || '|' || additive_energy(ROW(ARRAY[1,2,3,4], NULL::int)::finset)::text $q$),
  ('subsets','ONE definition on finset ⇒ every α inherits it: additive_energy is a resolved stat of finsets + k_subsets','eq','true','carrier-keyed inheritance (base_stat_resolved)',$q$
    SELECT (EXISTS (SELECT 1 FROM base_stat_resolved WHERE collection='finsets'   AND stat_id='additive_energy')
        AND EXISTS (SELECT 1 FROM base_stat_resolved WHERE collection='k_subsets' AND stat_id='additive_energy'))::text $q$),
  ('subsets','a BORROWED mathlib fact holds: E⁺(A) ≥ |A|² over every subset of [4]','eq','true','the alignment payoff — a Finset theorem, for free',$q$
    SELECT bool_and(additive_energy((e).value) >= cardinality((e).value)^2)::text FROM elements(subsets(4)) e $q$),
  ('subsets','finset {1,3,4}: span 3, gaps 1, odd 2, even 1','eq','3|1|2|1','the four new stats on one element',$q$
    SELECT subset_span(ROW(ARRAY[1,3,4], 4)::finset)::text || '|' || subset_gaps(ROW(ARRAY[1,3,4], 4)::finset)::text || '|' ||
           subset_odd_count(ROW(ARRAY[1,3,4], 4)::finset)::text || '|' || subset_even_count(ROW(ARRAY[1,3,4], 4)::finset)::text $q$),
  ('subsets','edge cases: span/gaps of {} are 0, of a singleton {2} are 0','eq','0|0|0|0','empty and singleton collapse to 0',$q$
    SELECT subset_span(ROW(ARRAY[]::int[], 0)::finset)::text || '|' || subset_gaps(ROW(ARRAY[]::int[], 0)::finset)::text || '|' ||
           subset_span(ROW(ARRAY[2], 2)::finset)::text || '|' || subset_gaps(ROW(ARRAY[2], 2)::finset)::text $q$),
  ('subsets','span distribution over subsets(4) is 5,3,4,4 (values 0..3)','eq','5,3,4,4','grouped over all 16 subsets of {1..4}',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT subset_span((e).value) k, count(*) c FROM elements(subsets(4)) e GROUP BY 1) t(k,c) $q$),
  ('subsets','gaps distribution over subsets(4) is 11,4,1 (values 0..2)','eq','11,4,1','#{ missing values strictly between min and max }',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT subset_gaps((e).value) k, count(*) c FROM elements(subsets(4)) e GROUP BY 1) t(k,c) $q$),
  ('subsets','odd-element distribution over subsets(4) is 4,8,4 (values 0..2)','eq','4,8,4','count of odd members {1,3}',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT subset_odd_count((e).value) k, count(*) c FROM elements(subsets(4)) e GROUP BY 1) t(k,c) $q$),
  ('subsets','even-element distribution over subsets(4) is 4,8,4 (values 0..2)','eq','4,8,4','count of even members {2,4}',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT subset_even_count((e).value) k, count(*) c FROM elements(subsets(4)) e GROUP BY 1) t(k,c) $q$),
  ('subsets','to_partition: {1,3,4} ↦ 4+3+1, {} ↦ 0 (empty partition)','eq','4+3+1|0','members largest-first as a partition',$q$
    SELECT notation(subset_to_partition(ROW(ARRAY[1,3,4], 4)::finset)) || '|' ||
           notation(subset_to_partition(ROW(ARRAY[]::int[], 0)::finset)) $q$),
  ('subsets','to_partition over the 2-subsets of {1,2,3} renders in the CODOMAIN form: 2+1,3+1,3+2','eq','2+1,3+1,3+2','the k=2 block of subsets(3) in colex order ↦ their partitions',$q$
    SELECT string_agg(render_value(subset_to_partition((e).value)), ',' ORDER BY ordinality(e))
    FROM elements(subsets(3)) e WHERE array_length(((e).value).members, 1) = 2 $q$);
