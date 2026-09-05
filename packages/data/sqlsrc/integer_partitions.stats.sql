-- requires: integer_partitions, realizer, utilities
-- integer_partitions — more statistics: number of distinct part sizes, number of odd/even parts, multiplicity
-- of the part 1, and the Durfee square size. Values derived + checked against sage's Partitions(n) over fibers.

-- number of distinct part sizes (FindStat St000097). e.g. 3+2+1 → 3, 2+2+1+1 → 2.
CREATE FUNCTION partition_distinct_parts(x integer_partition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(DISTINCT part)::int FROM unnest((x).parts) part $$;                     -- empty ⇒ 0

-- number of odd parts. e.g. 3+2+1 → 2 (the 3 and the 1). NOTE: NOT FindStat St000257 — that is "number of
-- distinct parts occurring at least twice" ([1,1] → 1, but odd_parts([1,1]) = 2); verified against findstat.org (#263).
CREATE FUNCTION partition_odd_parts(x integer_partition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM unnest((x).parts) part WHERE part % 2 = 1 $$;

-- number of even parts. e.g. 4+2 → 2, 3+2+1 → 1. NOTE: NOT FindStat St000256 — that is "number of parts from
-- which one can subtract 2 and still get a partition" ([2,2] → 1, but even_parts([2,2]) = 2); verified (#263).
CREATE FUNCTION partition_even_parts(x integer_partition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM unnest((x).parts) part WHERE part % 2 = 0 $$;

-- multiplicity of the part 1 (FindStat St000truncated: number of parts equal to 1). e.g. 2+1+1+1 → 3.
CREATE FUNCTION partition_parts_equal_one(x integer_partition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM unnest((x).parts) part WHERE part = 1 $$;

-- Durfee square size: the largest d with parts[d] >= d (side of the largest square fitting in the Young diagram).
-- Parts are stored non-increasing, so {i : parts[i] >= i} is a prefix and its max is the side. e.g. 3+2+1 → 2.
CREATE FUNCTION partition_durfee_square(x integer_partition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT max(i) FROM generate_subscripts((x).parts,1) i WHERE (x).parts[i] >= i), 0)::int $$;

-- beta-set / Maya diagram: the first-column hook lengths as a set of ℓ(λ) distinct non-negative integers,
-- B(λ) = { λᵢ + ℓ(λ) − i : i = 1..ℓ(λ) }. Injective (recoverable: sort B descending, λᵢ = Bᵢ − ℓ + i, trim zero
-- parts) — the standard bijection behind abacus/core-quotient algorithms. Hoisted here (core, not the
-- partitions-plus pack's frobenius_abacus file) because core's glyph_kinds dispatcher
-- (glyph_svg(integer_partition, 'abacus')) needs it too — a helper called from both sides is core machinery.
CREATE FUNCTION partition_beta_set(p integer_partition) RETURNS int[] LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_agg(v ORDER BY v), '{}'::int[]) FROM (
    SELECT (p).parts[i] + coalesce(array_length((p).parts,1),0) - i AS v
    FROM generate_subscripts((p).parts,1) i
  ) t $$;

-- ── register in base_stat (collection, stat_id, value_fn, title, codomain) ──────────────────────────────
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('integer_partitions','distinct_parts','partition_distinct_parts','Number of distinct parts','natural_numbers'),
  ('integer_partitions','odd_parts','partition_odd_parts','Number of odd parts','natural_numbers'),
  ('integer_partitions','even_parts','partition_even_parts','Number of even parts','natural_numbers'),
  ('integer_partitions','parts_equal_one','partition_parts_equal_one','Number of parts equal to 1','natural_numbers'),
  ('integer_partitions','durfee_square','partition_durfee_square','Durfee square size','natural_numbers');

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('integer_partitions','spot check on 3+2+1: distinct 3, odd 2, even 1, ones 1, durfee 2','eq','3|2|1|1|2','all five stats on a single partition',$q$
    SELECT partition_distinct_parts(ROW(ARRAY[3,2,1])::integer_partition)::text || '|' ||
           partition_odd_parts(ROW(ARRAY[3,2,1])::integer_partition)::text || '|' ||
           partition_even_parts(ROW(ARRAY[3,2,1])::integer_partition)::text || '|' ||
           partition_parts_equal_one(ROW(ARRAY[3,2,1])::integer_partition)::text || '|' ||
           partition_durfee_square(ROW(ARRAY[3,2,1])::integer_partition)::text $q$),
  ('integer_partitions','distinct-parts distribution over partitions of 6 = 4,6,1','eq','4,6,1','#{distinct part sizes}=1,2,3 has 4,6,1 partitions (sage Partitions(6))',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM
      (SELECT partition_distinct_parts((e).value) k, count(*) c FROM elements(integer_partitions(6)) e GROUP BY 1) t(k,c) $q$),
  ('integer_partitions','odd-parts distribution over partitions of 6 = 3,5,2,1','eq','3,5,2,1','#{odd parts}=0,2,4,6 (n even ⇒ even count) has 3,5,2,1 (sage)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM
      (SELECT partition_odd_parts((e).value) k, count(*) c FROM elements(integer_partitions(6)) e GROUP BY 1) t(k,c) $q$),
  ('integer_partitions','even-parts distribution over partitions of 6 = 4,4,2,1','eq','4,4,2,1','#{even parts}=0,1,2,3 has 4,4,2,1 (sage)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM
      (SELECT partition_even_parts((e).value) k, count(*) c FROM elements(integer_partitions(6)) e GROUP BY 1) t(k,c) $q$),
  ('integer_partitions','parts-equal-one per element of integer_partitions(5) in reverse-lex order','eq','0,1,0,2,1,3,5','multiplicity of 1 for 5,4+1,3+2,3+1+1,2+2+1,2+1+1+1,1+1+1+1+1',$q$
    SELECT string_agg(partition_parts_equal_one((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(integer_partitions(5)) e $q$),
  ('integer_partitions','Durfee square distribution over partitions of 6 = 6,5','eq','6,5','side d=1,2 has 6,5 partitions (sage; largest square in the Young diagram)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM
      (SELECT partition_durfee_square((e).value) k, count(*) c FROM elements(integer_partitions(6)) e GROUP BY 1) t(k,c) $q$);
