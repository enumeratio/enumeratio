-- requires: binary_words, subsets, k_subsets, realizer
-- binary_words_by_weight — the length-n binary words REFINED by Hamming weight: fiber (n,k) = the words with
-- EXACTLY k ones. Same `binary_word` carrier as binary_words — this is the WEIGHT-graded sibling of it (binary_words
-- grades by length n alone; here each n is split by weight k). Multi-grade chain [n, k]; k ranges 0..n, so
-- binary_words_by_weight(n) unfolds fibers over k and the row-sum Σ_k C(n,k) = 2ⁿ recovers |binary_words(n)|.
--
-- Within a fiber the order is INTEGER-VALUE ascending — exactly binary_words' order restricted to the weight-k
-- words. That value order is order-isomorphic to k_subsets(n,k)'s colex order via the combinatorial number system:
-- a weight-k word ↔ the k-subset of its 1-positions counted from the LSB (element e ⇒ the bit worth 2^(e-1), i.e.
-- array index n-e+1). So the ranking is BORROWED from k_subsets' subset_unrank_colex through that bijection.

-- ── the carrier↔subset bijection (the combinatorial number system) ─────────────────────────────────────
-- a k-subset s of [n] ↦ the length-n word (MSB first) with a 1 at array index n-e+1 for each member e.
CREATE FUNCTION binary_word_of_subset(s finset) RETURNS binary_word LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(SELECT (((s).n - i + 1) = ANY((s).members))::int
                     FROM generate_series(1, (s).n) i))::binary_word $$;
-- inverse: a word ↦ the subset { n-i+1 : bit i = 1 } over ground n = the word length (value ↔ colex).
CREATE FUNCTION subset_of_binary_word(w binary_word) RETURNS finset LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(SELECT coalesce(array_length((w).bits,1),0) - i + 1
                     FROM generate_subscripts((w).bits,1) i WHERE (w).bits[i] = 1
                     ORDER BY coalesce(array_length((w).bits,1),0) - i + 1),
             coalesce(array_length((w).bits,1),0))::finset $$;

-- ── the engines: BORROW k_subsets' colex ranking across the bijection ───────────────────────────────────
CREATE TYPE binary_words_by_weight_fiber AS (n natural_number, k natural_number);   -- typed fiber; axes: n, k
-- direct unrank (capability layer 3): the r-th weight-k word = the combinatorial-number-system k-subset, relabelled.
CREATE FUNCTION fiber_unrank(f binary_words_by_weight_fiber, rank rank_index) RETURNS binary_word LANGUAGE sql IMMUTABLE AS $$
  SELECT binary_word_of_subset(subset_unrank_colex((f).n::int, (f).k::int, rank)) $$;
CREATE FUNCTION fiber_elements(f binary_words_by_weight_fiber, element_limit int) RETURNS SETOF binary_word LANGUAGE sql STABLE AS $$
  SELECT fiber_unrank(f, ord::rank_index) FROM generate_series(0, binomial((f).n::int, (f).k::int)::int - 1) ord LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f binary_words_by_weight_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT binomial((f).n::int, (f).k::int)::numeric $$;                            -- C(n,k)
CREATE FUNCTION contains_in_fiber(f binary_words_by_weight_fiber, v binary_word) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((v).bits,1),0) = (f).n::int                        -- length n
     AND coalesce((SELECT bool_and(b IN (0,1)) FROM unnest((v).bits) b), true)    -- every bit 0/1
     AND coalesce((SELECT sum(b) FROM unnest((v).bits) b), 0) = (f).k::int $$;     -- exactly k ones

CREATE FUNCTION fiber_symbol(f binary_words_by_weight_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'W₂(' || (f).n::int || ',' || (f).k::int || ')' $$;   -- the C(n,k) weight-k words

-- ── declare as DATA + realize ────────────────────────────────────────────────────────────────────────
INSERT INTO base_collection VALUES ('binary_words_by_weight', 'binary_word');
INSERT INTO base_grade VALUES
  ('binary_words_by_weight', 1, 'n', NULL, NULL),
  ('binary_words_by_weight', 2, 'k', '0', 'g1');                                  -- weight k ranges 0..n
SELECT base_realize('binary_words_by_weight');

-- order-isomorphic to k_subsets: the 1-positions bijection carries value order onto colex order (both C(n,k)) — so it
-- is declared is_order_iso (verified below + in relations.sql), unlike Euler/crossing-nesting/RSK (bijections, not order-iso).
INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, scope, inverse, is_bijection, is_order_iso) VALUES
  ('binary_words_by_weight','to_k_subset','subset_of_binary_word','k_subsets','1-positions (combinatorial number system)','collection','to_binary_word',true,true),
  ('k_subsets','to_binary_word','binary_word_of_subset','binary_words_by_weight','the k-subset as a weight-k binary word','collection','to_k_subset',true,true);

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('binary_words_by_weight','weight-2 words of length 4 in value order','eq','0011,0101,0110,1001,1010,1100','the realized floor for fiber [4,2], C(4,2)=6',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(binary_words_by_weight(4,2)) e $q$),
  ('binary_words_by_weight','fiber counts for n=4 are the binomials C(4,k): 1,4,6,4,1','eq','1,4,6,4,1','k = 0..4 (accel)',$q$
    SELECT string_agg(cardinality(binary_words_by_weight(4,k))::text, ',' ORDER BY k) FROM generate_series(0,4) k $q$),
  ('binary_words_by_weight','row-sum over k recovers |binary_words(n)| = 2ⁿ, n=0..5','eq','1,2,4,8,16,32','Σ_k C(n,k) = 2ⁿ — the weight grid row-sum',$q$
    SELECT string_agg(cardinality(binary_words_by_weight(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('binary_words_by_weight','multi-grade chain: fiber = (n,k) named axes','eq','4|2','unrank(binary_words_by_weight(4,2), 0).fiber is (n=4,k=2)',$q$
    SELECT (unrank(binary_words_by_weight(4,2), 0)).fiber.n::text || '|' || (unrank(binary_words_by_weight(4,2), 0)).fiber.k::text $q$),
  ('binary_words_by_weight','fibers(binary_words_by_weight(4)) unfold to k = 0,1,2,3,4','eq','0,1,2,3,4','the weight axis ranges 0..n',$q$
    SELECT string_agg((f).k::text, ',' ORDER BY (f).k) FROM fibers(binary_words_by_weight(4)) f $q$),
  ('binary_words_by_weight','every element of fiber [5,2] has exactly 2 ones','eq','true','the defining invariant across the fiber',$q$
    SELECT bool_and((SELECT coalesce(sum(b),0) FROM unnest(((e).value).bits) b) = 2)::text FROM elements(binary_words_by_weight(5,2)) e $q$),
  -- BORROWED order: the within-fiber order IS binary_words' value order restricted to the weight-k words
  ('binary_words_by_weight','within-fiber order = binary_words(n) restricted to weight k (n=6,k=3)','eq','true','the parent value order, restricted',$q$
    SELECT (ARRAY(SELECT notation((e).value) FROM elements(binary_words_by_weight(6,3)) e ORDER BY ordinality(e))
          = ARRAY(SELECT notation((w).value) FROM elements(binary_words(6)) w
                   WHERE (SELECT coalesce(sum(b),0) FROM unnest(((w).value).bits) b) = 3 ORDER BY ordinality(w)))::text $q$),
  -- ORDER-ISO to k_subsets: the 1-positions bijection is order-preserving (value ↦ colex) for every n=0..6, k
  ('binary_words_by_weight','order-iso: 1-positions carry binary_words_by_weight(n,k) onto k_subsets(n,k) in order','eq','true','value order ↦ colex order (combinatorial number system)',$q$
    SELECT bool_and(
      ARRAY(SELECT notation(subset_of_binary_word((e).value)) FROM elements(binary_words_by_weight(n,k)) e ORDER BY ordinality(e))
    = ARRAY(SELECT notation((s).value) FROM elements(k_subsets(n,k)) s ORDER BY ordinality(s)))::text
    FROM generate_series(0,6) n, LATERAL generate_series(0,n) k $q$),
  ('binary_words_by_weight','the bijection round-trips: word ↦ subset ↦ word = id over binary_words_by_weight(5)','eq','true','subset_of_binary_word ∘ binary_word_of_subset = id',$q$
    SELECT bool_and(binary_word_of_subset(subset_of_binary_word((e).value)) = (e).value)::text
      FROM generate_series(0,5) k, LATERAL elements(binary_words_by_weight(5,k)) e $q$),
  ('binary_words_by_weight','both directions declared bijections with each other as inverse','eq','to_k_subset:t|to_binary_word:t','scope=collection, is_bijection, paired inverses',$q$
    SELECT 'to_k_subset:' || left((is_bijection AND inverse='to_binary_word')::text,1) || '|' ||
           'to_binary_word:' || left((SELECT (is_bijection AND inverse='to_k_subset')::text FROM base_map WHERE collection='k_subsets' AND map_id='to_binary_word'),1)
    FROM base_map WHERE collection='binary_words_by_weight' AND map_id='to_k_subset' $q$),
  ('binary_words_by_weight','contains via <@: 0101 ∈ (4,2), 0111 ∉ (4,2), 0101 ∉ (4,3)','eq','true|false|false','generated from contains_in_fiber',$q$
    SELECT (ROW(ARRAY[0,1,0,1])::binary_word <@ binary_words_by_weight(4,2))::text || '|' ||
           (ROW(ARRAY[0,1,1,1])::binary_word <@ binary_words_by_weight(4,2))::text || '|' ||
           (ROW(ARRAY[0,1,0,1])::binary_word <@ binary_words_by_weight(4,3))::text $q$);
