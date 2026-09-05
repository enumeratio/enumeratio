-- requires: realizer
-- requires-tag: collection
-- set-builder rendering (KaTeX) for the other major graded carriers — composition, set_partition, word,
-- binary_word, parking_function — completing the registry started by finset_set_builder (representations.sql).
-- Same shape as that one: builder_fn(jsonb axes) RETURNS text, dispatched by the generic set_builder(fiber) in
-- realizer.sql off the fiber's CARRIER. requires-tag:collection is a safe late anchor — every base_collection /
-- base_grade insert (hence every carrier + fiber type) has already run by the time this file applies.
--
-- NOT covered: `permutation`. representations.sql:198 has a golden example asserting set_builder(permutations(3))
-- IS NULL, used as the canonical demo of "a carrier with no registered template" — registering one for `permutation`
-- here would falsify that example, and this file may not edit representations.sql. See close-out.
--
-- Gotcha found while porting: a carrier's axis NAMES are not stable across every collection that shares it — e.g.
-- integer_compositions_fiber uses `n` alone, but compositions_into_k_parts/k_bounded_compositions (same `composition`
-- carrier) grade as `n,k`/`n,max_parts`. Each builder below spells out the extra axes it has fixed semantics for.

-- ── composition (base: integer_compositions, axis `n`; compositions_into_k_parts adds `k`, k_bounded_compositions
--    adds `max_parts` — both meaningful, so spelled out rather than folded into the generic fallback) ──────────
CREATE FUNCTION composition_set_builder(axes jsonb) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN axes ? 'k'         THEN '\{\, \text{compositions of } ' || (axes->>'n') || ' \text{ into } ' || (axes->>'k') || ' \text{ parts} \,\}'
    WHEN axes ? 'max_parts' THEN '\{\, \text{compositions of } ' || (axes->>'n') || ' \text{ with at most } ' || (axes->>'max_parts') || ' \text{ parts} \,\}'
    ELSE                          '\{\, \text{compositions of } ' || (axes->>'n') || ' \,\}'
  END $$;
INSERT INTO base_set_builder (carrier, builder_fn) VALUES ('composition', 'composition_set_builder');

-- ── set_partition (base: set_partitions, axis `n`; set_partitions_into_k_blocks adds `k` = exact block count) ──
CREATE FUNCTION set_partition_set_builder(axes jsonb) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT '\{\, \pi \in \Pi([' || (axes->>'n') || '])' ||
         CASE WHEN axes ? 'k' THEN ' : |\pi| = ' || (axes->>'k') ELSE '' END || ' \,\}' $$;
INSERT INTO base_set_builder (carrier, builder_fn) VALUES ('set_partition', 'set_partition_set_builder');

-- ── word (base: words, axes `size`,`base` — the k-ary word carrier; binary_words/calkin_wilf_paths/stern_brocot_paths
--    live on the SEPARATE `binary_word` carrier, not this one — see below) ──────────────────────────────────────
CREATE FUNCTION word_set_builder(axes jsonb) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT '\{\, w \in [' || (axes->>'base') || ']^{' || (axes->>'size') || '} \,\}' $$;
INSERT INTO base_set_builder (carrier, builder_fn) VALUES ('word', 'word_set_builder');

-- ── binary_word (base: binary_words, axis `n`; the fixed-alphabet {0,1} sibling of `word`) ─────────────────────
CREATE FUNCTION binary_word_set_builder(axes jsonb) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT '\{\, w \in \{0,1\}^{' || (axes->>'n') || '} \,\}' $$;
INSERT INTO base_set_builder (carrier, builder_fn) VALUES ('binary_word', 'binary_word_set_builder');

-- (parking_function builder moved to packs/permutations-plus/set_builders.permutations-plus.sql — its only
-- example called parking_functions(), a permutations-plus collection, #283 phase 3)

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('set_builders','composition set-builder: integer_compositions(4)','eq','\{\, \text{compositions of } 4 \,\}','the composition carrier, unqualified',$q$
    SELECT set_builder((unrank(integer_compositions(4), 0)).fiber) $q$),
  ('set_builders','composition set-builder, k-graded: compositions_into_k_parts(5,2)','eq','\{\, \text{compositions of } 5 \text{ into } 2 \text{ parts} \,\}','extra axis spelled out, not folded generic',$q$
    SELECT set_builder((unrank(compositions_into_k_parts(5,2), 0)).fiber) $q$),
  ('set_builders','set_partition set-builder: set_partitions(3)','eq','\{\, \pi \in \Pi([3]) \,\}','the set_partition carrier over its n axis',$q$
    SELECT set_builder((unrank(set_partitions(3), 0)).fiber) $q$),
  ('set_builders','set_partition set-builder, k-graded: set_partitions_into_k_blocks(4,2)','eq','\{\, \pi \in \Pi([4]) : |\pi| = 2 \,\}','exactly k blocks (Stirling S(n,k))',$q$
    SELECT set_builder((unrank(set_partitions_into_k_blocks(4,2), 0)).fiber) $q$),
  ('set_builders','word set-builder: words(4,3)','eq','\{\, w \in [3]^{4} \,\}','the k-ary word carrier over size×base',$q$
    SELECT set_builder((unrank(words(4,3), 0)).fiber) $q$),
  ('set_builders','binary_word set-builder: binary_words(5)','eq','\{\, w \in \{0,1\}^{5} \,\}','the fixed-alphabet word sibling',$q$
    SELECT set_builder((unrank(binary_words(5), 0)).fiber) $q$),
  -- floor, not an exact count (post-#171 convention) — a pack may register more carriers (e.g.
  -- packs/permutations-plus/set_builders.permutations-plus.sql's parking_function), so this only asserts what
  -- THIS file registers is duplicate-free and present, never a total across every pack that might be loaded.
  ('set_builders','no duplicate carrier rows among the ones registered here, vs finset','eq','true|true',
   'one row per NEW carrier registered in this file (finset stays representations.sql''s)',$q$
    SELECT (count(*) = count(DISTINCT carrier))::text || '|' ||
           ((SELECT array_agg(carrier) FROM base_set_builder) @> ARRAY['composition','set_partition','word','binary_word'])::text
    FROM base_set_builder WHERE carrier <> 'finset' $q$);
