-- requires: relations, binary_words_by_weight
-- words-plus half of sqlsrc/relations.sql's binary_words_by_weight↔k_subsets checks (#283 phase 3 extraction) —
-- split out because base_relation is populated by core's relations.sql (a core-owned TABLE + one-shot INSERT…SELECT,
-- re-derived per pack by base_relation_pack_finalize) and this pack only adds examples over the row that INSERT
-- already produces once binary_words_by_weight's own base_map rows (declared inside binary_words_by_weight.sql
-- itself) exist.

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('relations','the order-iso relation is flagged: binary_words_by_weight ↔ k_subsets is the only is_order_iso row','eq','binary_words_by_weight→k_subsets','is_order_iso holds exactly where declared',$q$
    SELECT string_agg(domain||'→'||codomain, ',' ORDER BY domain) FROM base_relation WHERE is_order_iso $q$),
  -- is_order_iso VERIFIED (window where both sides finite): the flagged relation's forward map is order-preserving —
  -- the k-th element of binary_words_by_weight(n,k) maps to the k-th element of k_subsets(n,k), n=0..6.
  ('relations','is_order_iso verified: the declared order-iso forward map preserves rank order, n=0..6','eq','true','k-th domain element ↦ k-th codomain element',$q$
    SELECT bool_and(
      ARRAY(SELECT notation(subset_of_binary_word((e).value)) FROM elements(binary_words_by_weight(n,k)) e ORDER BY ordinality(e))
    = ARRAY(SELECT notation((s).value) FROM elements(k_subsets(n,k)) s ORDER BY ordinality(s)))::text
    FROM base_relation r, LATERAL generate_series(0,6) n, LATERAL generate_series(0,n) k
   WHERE r.is_order_iso AND r.domain='binary_words_by_weight' $q$),
  -- forward∘backward = id on samples: the relation round-trips through both stored fns.
  ('relations','forward∘backward = id on samples (binary_words_by_weight↔k_subsets): backward(forward(w)) = w','eq','true','the order-iso relation round-trips too',$q$
    SELECT bool_and(binary_word_of_subset(subset_of_binary_word((e).value)) = (e).value)::text
      FROM generate_series(0,5) k, LATERAL elements(binary_words_by_weight(5,k)) e $q$);
