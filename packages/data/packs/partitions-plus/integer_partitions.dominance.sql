-- requires: integer_partitions, realizer, utilities
-- integer_partitions — the dominance order (issue #230). λ dominates μ (both ⊢ n) iff every prefix sum of λ is at
-- least the corresponding prefix sum of μ: Σᵢ₌₁ᵏ λᵢ ≥ Σᵢ₌₁ᵏ μᵢ for every k. A partial order on partitions of n (NOT
-- total from n=6 on — see the incomparable pair below), with (n) as the unique max and (1ⁿ) the unique min.
--
-- This is deliberately just the PREDICATE, not a registered relation: base_element_relation (a poset/Hasse-diagram
-- registry for a collection's OWN elements) doesn't exist yet (catalog-audit.md friction #1, ticket #237). This
-- function is the payload #237's relation batch can pick up — same shape as self_conjugate_partitions.sql's
-- is_self_conjugate_partition, a plain predicate ahead of its registry.

CREATE FUNCTION partition_dominates(a integer_partition, b integer_partition) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM generate_series(1, greatest(coalesce(array_length((a).parts,1),0), coalesce(array_length((b).parts,1),0))) k
     WHERE (SELECT coalesce(sum(x),0) FROM unnest((a).parts[1:k]) x) < (SELECT coalesce(sum(x),0) FROM unnest((b).parts[1:k]) x)
  ) $$;

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('integer_partitions','dominance: 6 dominates 5+1 dominates 4+2, and dominance is reflexive','eq','true|true|true','the top of the order on partitions of 6',$q$
    SELECT partition_dominates(ROW(ARRAY[6])::integer_partition, ROW(ARRAY[5,1])::integer_partition)::text || '|' ||
           partition_dominates(ROW(ARRAY[5,1])::integer_partition, ROW(ARRAY[4,2])::integer_partition)::text || '|' ||
           partition_dominates(ROW(ARRAY[3,2,1])::integer_partition, ROW(ARRAY[3,2,1])::integer_partition)::text $q$),
  ('integer_partitions','dominance cover: 6 ⋗ 5+1 — nothing among the partitions of 6 sits strictly between them','eq','true','a genuine Hasse-diagram edge, checked against the whole fiber',$q$
    SELECT (partition_dominates(ROW(ARRAY[6])::integer_partition, ROW(ARRAY[5,1])::integer_partition)
        AND NOT EXISTS (
          SELECT 1 FROM elements(integer_partitions(6)) e
           WHERE partition_dominates(ROW(ARRAY[6])::integer_partition, (e).value)
             AND partition_dominates((e).value, ROW(ARRAY[5,1])::integer_partition)
             AND notation((e).value) NOT IN ('6','5+1')
        ))::text $q$),
  ('integer_partitions','dominance cover: 5+1 ⋗ 4+2 — likewise a genuine cover, not just a comparison','eq','true','checked against the whole fiber of partitions of 6',$q$
    SELECT (partition_dominates(ROW(ARRAY[5,1])::integer_partition, ROW(ARRAY[4,2])::integer_partition)
        AND NOT EXISTS (
          SELECT 1 FROM elements(integer_partitions(6)) e
           WHERE partition_dominates(ROW(ARRAY[5,1])::integer_partition, (e).value)
             AND partition_dominates((e).value, ROW(ARRAY[4,2])::integer_partition)
             AND notation((e).value) NOT IN ('5+1','4+2')
        ))::text $q$),
  ('integer_partitions','dominance is only a PARTIAL order from n=6 on: 3+3 and 4+1+1 are incomparable','eq','false|false','neither dominates the other — the classical minimal witness',$q$
    SELECT partition_dominates(ROW(ARRAY[3,3])::integer_partition, ROW(ARRAY[4,1,1])::integer_partition)::text || '|' ||
           partition_dominates(ROW(ARRAY[4,1,1])::integer_partition, ROW(ARRAY[3,3])::integer_partition)::text $q$),
  ('integer_partitions','1+1+1+1+1+1 is dominated by every partition of 6 (the unique minimum)','eq','true','Σ of the first k parts of 1ⁿ is the smallest possible, for every k',$q$
    SELECT bool_and(partition_dominates((e).value, ROW(ARRAY[1,1,1,1,1,1])::integer_partition))::text
    FROM elements(integer_partitions(6)) e $q$),
  ('integer_partitions','6 dominates every partition of 6 (the unique maximum)','eq','true','Σ of the first k parts of (n) saturates at n immediately',$q$
    SELECT bool_and(partition_dominates(ROW(ARRAY[6])::integer_partition, (e).value))::text
    FROM elements(integer_partitions(6)) e $q$),
  ('integer_partitions','dominance is antisymmetric on partitions of 6: mutual domination forces equality','eq','true','no two distinct partitions of 6 dominate each other both ways',$q$
    SELECT (NOT EXISTS (
      SELECT 1 FROM elements(integer_partitions(6)) a, elements(integer_partitions(6)) b
       WHERE notation((a).value) <> notation((b).value)
         AND partition_dominates((a).value, (b).value) AND partition_dominates((b).value, (a).value)
    ))::text $q$);
