-- requires: integer_partitions, integer_partitions.stats, statistics, core_partitions, self_conjugate_partitions, standard_tableaux.stats, references, realizer, utilities
-- integer_partitions — deeper statistics (issue #230): Dyson rank, the Andrews-Garvan crank, removable cells
-- ("corners" — the same count as distinct_parts, given a second FindStat-aligned name), the hook-length product and
-- the hook-length formula's f^λ (number of standard tableaux), plus a handful of smaller invariants. FindStat ids
-- are seeded ONLY where independently confirmed against findstat.org (fabrication guard, findstat-refs.sql) —
-- several classical names below (multiplicity_of_largest_part, sum_of_hook_lengths, arm/leg of the first cell,
-- perimeter, is_self_conjugate as an int stat) have no confirmed St-number and are registered without one.

-- ── every cell's hook length, per element (overloads core_partitions.sql's partition_hook_lengths(int[])) ──
-- hook(i,j) = arm + leg + 1 for EVERY cell (i,j) of the Young diagram, not just the first column — reused below
-- for the hook product / f^λ / sum-of-hooks stats. (The first-column-only special case, the beta-set, is a
-- separate computation: integer_partitions.frobenius_abacus.sql's partition_beta_set.)
CREATE FUNCTION partition_hook_lengths(p integer_partition) RETURNS SETOF int LANGUAGE sql IMMUTABLE AS $$
  SELECT * FROM partition_hook_lengths((p).parts) $$;

-- Dyson rank (FindStat St000145): largest part minus number of parts. Named `dyson_rank`, not `rank` — `rank` is
-- the structural rank-in-fiber column every collection already carries (address, not this statistic).
CREATE FUNCTION partition_dyson_rank(p integer_partition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT partition_largest(p) - partition_length(p) $$;

-- Andrews-Garvan crank (FindStat St000146): ω = #parts equal to 1; if ω=0 the crank is the largest part, else the
-- number of parts strictly greater than ω, minus ω. (Explains Ramanujan's mod-11 partition congruence, as rank
-- explains mod 5/7.)
CREATE FUNCTION partition_crank(p integer_partition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN o = 0 THEN coalesce((p).parts[1], 0) ELSE mu - o END
  FROM (SELECT count(*)::int AS o FROM unnest((p).parts) x WHERE x = 1) t1,
       LATERAL (SELECT count(*)::int AS mu FROM unnest((p).parts) x WHERE x > t1.o) t2 $$;

-- product of the hook lengths — n!/hook_product is the number of standard tableaux (hook length formula).
CREATE FUNCTION partition_hook_product(p integer_partition) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE result numeric := 1; h int;
  BEGIN
    FOR h IN SELECT * FROM partition_hook_lengths(p) LOOP result := result * h; END LOOP;
    RETURN result;   -- empty partition: no hooks, loop never runs, result stays 1 (0! / 1 = 1, the one empty SYT)
  END $$;

-- f^λ, the number of standard Young tableaux of shape λ (FindStat St000003) — the hook length formula, n!/∏hooks.
CREATE FUNCTION partition_number_of_standard_tableaux(p integer_partition) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT round(factorial(coalesce((SELECT sum(x) FROM unnest((p).parts) x), 0)::int) / partition_hook_product(p)) $$;

-- multiplicity of the largest part: how many parts tie for λ_1 (non-increasing storage ⇒ they're a prefix run).
CREATE FUNCTION partition_multiplicity_of_largest_part(p integer_partition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM unnest((p).parts) x WHERE x = coalesce((p).parts[1], 0) $$;   -- empty ⇒ 0 (no part equals 0)

-- sum of all hook lengths over the whole diagram (not just the first column).
CREATE FUNCTION partition_sum_of_hook_lengths(p integer_partition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(sum(h), 0)::int FROM partition_hook_lengths(p) h $$;

-- arm and leg of the first (top-left, (1,1)) cell: arm = λ_1 − 1 (cells to its right in row 1), leg = ℓ(λ) − 1
-- (cells below it in column 1). Their sum + 1 is that cell's hook length; empty partition ⇒ both 0.
CREATE FUNCTION partition_arm_of_first_cell(p integer_partition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT greatest(coalesce((p).parts[1], 0) - 1, 0) $$;
CREATE FUNCTION partition_leg_of_first_cell(p integer_partition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT greatest(coalesce(array_length((p).parts, 1), 0) - 1, 0) $$;

-- perimeter of the Young diagram: λ_1 + ℓ(λ), the length of its staircase boundary path (ℓ vertical unit steps
-- interleaved with λ_1 horizontal ones) — equivalently arm_of_first_cell + leg_of_first_cell + 2 for n ≥ 1.
CREATE FUNCTION partition_perimeter(p integer_partition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((p).parts[1], 0) + coalesce(array_length((p).parts, 1), 0) $$;

-- is_self_conjugate as an INT stat (0/1, not boolean — the client builds min/max/sum over every stat and pg has
-- no min/max(boolean), CLAUDE.md gotcha): wraps self_conjugate_partitions.sql's own predicate so GROUP BY can see it.
CREATE FUNCTION partition_is_self_conjugate_stat(p integer_partition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN is_self_conjugate_partition(p) THEN 1 ELSE 0 END $$;

-- ── register in base_stat ─────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('integer_partitions','dyson_rank','partition_dyson_rank','Dyson rank','natural_numbers'),
  ('integer_partitions','crank','partition_crank','Andrews-Garvan crank','natural_numbers'),
  ('integer_partitions','corners','partition_distinct_parts','Number of removable cells (corners)','natural_numbers'),
  ('integer_partitions','hook_product','partition_hook_product','Product of hook lengths','natural_numbers'),
  ('integer_partitions','number_of_standard_tableaux','partition_number_of_standard_tableaux','Number of standard tableaux (f^λ)','natural_numbers'),
  ('integer_partitions','multiplicity_of_largest_part','partition_multiplicity_of_largest_part','Multiplicity of the largest part','natural_numbers'),
  ('integer_partitions','sum_of_hook_lengths','partition_sum_of_hook_lengths','Sum of hook lengths','natural_numbers'),
  ('integer_partitions','arm_of_first_cell','partition_arm_of_first_cell','Arm of the first cell','natural_numbers'),
  ('integer_partitions','leg_of_first_cell','partition_leg_of_first_cell','Leg of the first cell','natural_numbers'),
  ('integer_partitions','perimeter','partition_perimeter','Perimeter of the Young diagram','natural_numbers'),
  ('integer_partitions','is_self_conjugate','partition_is_self_conjugate_stat','Is self-conjugate (0/1)','natural_numbers');

-- ── FindStat cross-references (base_reference; only independently confirmed St-numbers) ────────────────────
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('stat','integer_partitions.dyson_rank',                 'findstat','St000145','https://www.findstat.org/St000145',''),
  ('stat','integer_partitions.crank',                       'findstat','St000146','https://www.findstat.org/St000146',''),
  ('stat','integer_partitions.corners',                     'findstat','St000159','https://www.findstat.org/St000159',''),
  ('stat','integer_partitions.distinct_parts',               'findstat','St000159','https://www.findstat.org/St000159',''),
  ('stat','integer_partitions.hook_product',                 'findstat','St000179','https://www.findstat.org/St000179',''),
  ('stat','integer_partitions.number_of_standard_tableaux',  'findstat','St000003','https://www.findstat.org/St000003','');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('integer_partitions','dyson_rank: 3+2+1 → 0 (3−3), 4+1 → 2 (4−2), 1+1+1 → −2 (1−3)','eq','0|2|-2','largest part minus length, can be negative',$q$
    SELECT partition_dyson_rank(ROW(ARRAY[3,2,1])::integer_partition)::text || '|' ||
           partition_dyson_rank(ROW(ARRAY[4,1])::integer_partition)::text || '|' ||
           partition_dyson_rank(ROW(ARRAY[1,1,1])::integer_partition)::text $q$),
  ('integer_partitions','dyson_rank distribution over partitions of 5 (rank mod 5 splits p(5)=7 into 5 near-equal classes, Dyson''s conjecture)','eq','true','every rank mod 5 class has either 1 or 2 of the 7 partitions',$q$
    SELECT bool_and(c BETWEEN 1 AND 2)::text FROM
      (SELECT ((partition_dyson_rank((e).value) % 5) + 5) % 5 k, count(*) c FROM elements(integer_partitions(5)) e GROUP BY 1) t(k,c) $q$),
  ('integer_partitions','crank: 3+2 → 3 (no ones ⇒ largest part), 2+1+1 → −2 (μ=0,ω=2), 1+1+1 → −3 (μ=0,ω=3)','eq','3|-2|-3','Andrews-Garvan crank',$q$
    SELECT partition_crank(ROW(ARRAY[3,2])::integer_partition)::text || '|' ||
           partition_crank(ROW(ARRAY[2,1,1])::integer_partition)::text || '|' ||
           partition_crank(ROW(ARRAY[1,1,1])::integer_partition)::text $q$),
  ('integer_partitions','corners: 3+2+1 (3 distinct sizes) → 3, 2+2+1+1 (2 distinct sizes) → 2 — matches distinct_parts (FindStat St000159 equivalence)','eq','3|2','one removable cell per maximal run of equal parts',$q$
    SELECT partition_distinct_parts(ROW(ARRAY[3,2,1])::integer_partition)::text || '|' ||
           partition_distinct_parts(ROW(ARRAY[2,2,1,1])::integer_partition)::text $q$),
  ('integer_partitions','hook lengths of 3+1: cell(1,1)=4, cell(1,2)=2, cell(1,3)=1, cell(2,1)=1 — product 8, sum 8','eq','8|8','partition_hook_lengths overload on the composite carrier',$q$
    SELECT partition_hook_product(ROW(ARRAY[3,1])::integer_partition)::text || '|' ||
           partition_sum_of_hook_lengths(ROW(ARRAY[3,1])::integer_partition)::text $q$),
  ('integer_partitions','f^λ via the hook length formula: 3+1 → 3 SYT, 2+2 → 2 SYT, 2+1+1 → 3 SYT (n=4, Σ(f^λ)² = 4! = 24)','eq','3|2|3','n!/∏hooks',$q$
    SELECT partition_number_of_standard_tableaux(ROW(ARRAY[3,1])::integer_partition)::text || '|' ||
           partition_number_of_standard_tableaux(ROW(ARRAY[2,2])::integer_partition)::text || '|' ||
           partition_number_of_standard_tableaux(ROW(ARRAY[2,1,1])::integer_partition)::text $q$),
  ('integer_partitions','f^λ cross-checked against cardinality of the matching standard_tableaux(4) shapes (RSK: Σ over shapes of f^λ elements = T(4)=10)','eq','true','partition_number_of_standard_tableaux(shape) = #{SYT of size 4 with that shape}',$q$
    SELECT bool_and(
      partition_number_of_standard_tableaux(shp) = (
        SELECT count(*) FROM elements(standard_tableaux(4)) e WHERE standard_tableau_shape((e).value) = shp))::text
    FROM (SELECT DISTINCT standard_tableau_shape((e).value) shp FROM elements(standard_tableaux(4)) e) shapes $q$),
  ('integer_partitions','multiplicity_of_largest_part: 3+3+3+1 → 3, 4+2+1 → 1, empty → 0','eq','3|1|0','count of the leading run',$q$
    SELECT partition_multiplicity_of_largest_part(ROW(ARRAY[3,3,3,1])::integer_partition)::text || '|' ||
           partition_multiplicity_of_largest_part(ROW(ARRAY[4,2,1])::integer_partition)::text || '|' ||
           partition_multiplicity_of_largest_part(ROW(ARRAY[]::int[])::integer_partition)::text $q$),
  ('integer_partitions','arm/leg of the first cell on 4+2+1: arm=3, leg=2, perimeter=7 (=arm+leg+2)','eq','3|2|7','λ_1−1, ℓ−1, λ_1+ℓ',$q$
    SELECT partition_arm_of_first_cell(ROW(ARRAY[4,2,1])::integer_partition)::text || '|' ||
           partition_leg_of_first_cell(ROW(ARRAY[4,2,1])::integer_partition)::text || '|' ||
           partition_perimeter(ROW(ARRAY[4,2,1])::integer_partition)::text $q$),
  ('integer_partitions','empty partition: arm/leg/perimeter all 0','eq','0|0|0','n=0 has no cells at all',$q$
    SELECT partition_arm_of_first_cell(ROW(ARRAY[]::int[])::integer_partition)::text || '|' ||
           partition_leg_of_first_cell(ROW(ARRAY[]::int[])::integer_partition)::text || '|' ||
           partition_perimeter(ROW(ARRAY[]::int[])::integer_partition)::text $q$),
  ('integer_partitions','is_self_conjugate stat agrees with the self_conjugate_partitions restriction predicate over partitions of 8','eq','true','the int(0/1) wrapper matches the boolean predicate for every element',$q$
    SELECT bool_and((partition_is_self_conjugate_stat((e).value) = 1) = is_self_conjugate_partition((e).value))::text
    FROM elements(integer_partitions(8)) e $q$),
  ('integer_partitions','FindStat refs resolve: dyson_rank St000145, crank St000146, corners St000159, hook_product St000179, number_of_standard_tableaux St000003','eq','St000145|St000146|St000159|St000179|St000003','base_reference subject_kind=stat rows',$q$
    SELECT (SELECT identity FROM base_reference WHERE subject_kind='stat' AND subject='integer_partitions.dyson_rank') || '|' ||
           (SELECT identity FROM base_reference WHERE subject_kind='stat' AND subject='integer_partitions.crank') || '|' ||
           (SELECT identity FROM base_reference WHERE subject_kind='stat' AND subject='integer_partitions.corners') || '|' ||
           (SELECT identity FROM base_reference WHERE subject_kind='stat' AND subject='integer_partitions.hook_product') || '|' ||
           (SELECT identity FROM base_reference WHERE subject_kind='stat' AND subject='integer_partitions.number_of_standard_tableaux') $q$),
  ('integer_partitions','the registry lists at least the new depth stats (a floor — more may be added)','eq','true','base_stat rows',$q$
    SELECT (array_agg(stat_id) @> ARRAY['arm_of_first_cell','corners','crank','dyson_rank','hook_product','is_self_conjugate','leg_of_first_cell','multiplicity_of_largest_part','number_of_standard_tableaux','perimeter','sum_of_hook_lengths'])::text
    FROM base_stat WHERE collection = 'integer_partitions' $q$);
