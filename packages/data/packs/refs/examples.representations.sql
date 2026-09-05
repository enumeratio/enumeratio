-- requires: representations, seed.render_corpus
-- These `representations` examples verify core katex render_fns against the seed.render_corpus oracle
-- (base_render_corpus, packs/refs/seed.render_corpus.sql) — split out of sqlsrc/representations.sql (#283
-- phase 2.2) because the oracle table itself lives in this pack; representations.sql keeps the
-- notation()-unchanged / dispatch-shape examples that need no pack data.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('representations','dense base-36 matches the render-corpus oracle (#193): permutations~size/10@1 and ~size/40@0','eq','true','seed.render_corpus.sql''s aspirational base-36 golden rows',$q$
    SELECT (perm_oneline_dense(ROW(ARRAY[1,2,3,4,5,6,7,8,10,9])::permutation)
              = split_part((SELECT unicode FROM base_render_corpus WHERE family_path = 'permutations~size/10@1'), ' ∈ ', 1)
        AND perm_oneline_dense(ROW(ARRAY(SELECT generate_series(1,40)))::permutation)
              = split_part((SELECT unicode FROM base_render_corpus WHERE family_path = 'permutations~size/40@0'), ' ∈ ', 1))::text $q$),
  ('representations','the oneline katex sibling matches the render-corpus oracle: n=10 rank1 → (1,2,3,4,5,6,7,8,10,9)','eq','true','split_part(katex, '' ∈ '', 1) from permutations~size/10@1',$q$
    SELECT (perm_oneline_katex(ROW(ARRAY[1,2,3,4,5,6,7,8,10,9])::permutation)
              = split_part((SELECT katex FROM base_render_corpus WHERE family_path = 'permutations~size/10@1'), ' ∈ ', 1))::text $q$),
  ('representations','the composition parts katex sibling matches the render-corpus oracle: n=4@7 → (1,1,1,1)','eq','true','split_part(katex, '' ∈ '', 1) from integer_compositions~size/4@7',$q$
    SELECT (composition_parts_katex(ROW(ARRAY[1,1,1,1])::composition)
              = split_part((SELECT katex FROM base_render_corpus WHERE family_path = 'integer_compositions~size/4@7'), ' ∈ ', 1))::text $q$),
  ('representations','the set_partition blocks katex sibling matches the render-corpus oracle: rgs 0,1,0,2 → {{1,3},{2},{4}}','eq','true','split_part(katex, '' ∈ '', 1) from set_partitions~size/4@rgs:0,1,0,2',$q$
    SELECT (set_partition_blocks_katex(ROW(ARRAY[0,1,0,2])::set_partition)
              = split_part((SELECT katex FROM base_render_corpus WHERE family_path = 'set_partitions~size/4@rgs:0,1,0,2'), ' ∈ ', 1))::text $q$),
  ('representations','the finset members repr and its katex sibling match the render-corpus oracle: n=5, members {1,3}','eq','{1,3}|true','split_part(katex, '' ∈ '', 1) from subsets~n/5@members:1,3',$q$
    SELECT finset_members(ROW(ARRAY[1,3],5)::finset) || '|' ||
           (finset_members_katex(ROW(ARRAY[1,3],5)::finset)
              = split_part((SELECT katex FROM base_render_corpus WHERE family_path = 'subsets~n/5@members:1,3'), ' ∈ ', 1))::text $q$),
  ('representations','signed_permutation katex bars negatives and matches the render-corpus oracle: n=3 rank47 → (3̅,2̅,1̅)','eq','true','split_part(katex, '' ∈ '', 1) from signed_permutations~size/3@47',$q$
    SELECT (signed_permutation_katex(ROW(ARRAY[-3,-2,-1])::signed_permutation)
              = split_part((SELECT katex FROM base_render_corpus WHERE family_path = 'signed_permutations~size/3@47'), ' ∈ ', 1))::text $q$),
  ('representations','signed_subset katex escapes braces + bars negatives, matches the render-corpus oracle: n=4 rank15 → {1,2̅,3}','eq','true','split_part(katex, '' ∈ '', 1) from signed_subsets~size/4@15',$q$
    SELECT (signed_subset_members_katex(ROW(ARRAY[1,-2,3],4)::signed_subset)
              = split_part((SELECT katex FROM base_render_corpus WHERE family_path = 'signed_subsets~size/4@15'), ' ∈ ', 1))::text $q$),
  ('representations','set_composition katex escapes braces but keeps block ORDER as a tuple, matches the render-corpus oracle: n=4 blocks {1,2}{3,4} → ({1,2},{3,4})','eq','true','split_part(katex, '' ∈ '', 1) from set_compositions~size/4@1,2!3,4',$q$
    SELECT (set_composition_blocks_katex(ROW(ARRAY[1,1,2,2])::set_composition)
              = split_part((SELECT katex FROM base_render_corpus WHERE family_path = 'set_compositions~size/4@1,2!3,4'), ' ∈ ', 1))::text $q$),
  ('representations','surjection katex wraps the word as a tuple, matches the render-corpus oracle: k=3 n=3 rank0 → (1,2,3)','eq','true','split_part(katex, '' ∈ '', 1) from surjections~k=3~size/3@1,2,3',$q$
    SELECT (surjection_tuple_katex(ROW(ARRAY[1,2,3])::surjection)
              = split_part((SELECT katex FROM base_render_corpus WHERE family_path = 'surjections~k=3~size/3@1,2,3'), ' ∈ ', 1))::text $q$),
  ('representations','parking_function katex wraps the sequence as a tuple, matches the render-corpus oracle: n=3 all-ones → (1,1,1)','eq','true','split_part(katex, '' ∈ '', 1) from parking_functions~size/3@1,1,1',$q$
    SELECT (parking_function_tuple_katex(ROW(ARRAY[1,1,1])::parking_function)
              = split_part((SELECT katex FROM base_render_corpus WHERE family_path = 'parking_functions~size/3@1,1,1'), ' ∈ ', 1))::text $q$),
  ('representations','binary_word digits katex matches the render-corpus oracle across all four verified restrictions: fib/lucas/tri/primitive','eq','true','each split_part(katex, '' ∈ '', 1) from its own corpus row',$q$
    SELECT (binary_word_digits_katex((unrank(fib_strings(3), 4)).value)
              = split_part((SELECT katex FROM base_render_corpus WHERE family_path = 'fib_strings~size/3@4'), ' ∈ ', 1)
        AND binary_word_digits_katex((unrank(lucas_strings(4), 4)).value)
              = split_part((SELECT katex FROM base_render_corpus WHERE family_path = 'lucas_strings~size/4@4'), ' ∈ ', 1)
        AND binary_word_digits_katex((unrank(tri_strings(3), 6)).value)
              = split_part((SELECT katex FROM base_render_corpus WHERE family_path = 'tri_strings~size/3@6'), ' ∈ ', 1)
        AND binary_word_digits_katex((unrank(primitive_binary_strings(4), 0)).value)
              = split_part((SELECT katex FROM base_render_corpus WHERE family_path = 'primitive_binary_strings~size/4@0'), ' ∈ ', 1))::text $q$),
  ('representations','fractional_number katex is a genuine \frac{a}{b}, matches the render-corpus oracle: 6/8','eq','true','split_part(katex, '' ∈ '', 1) from fractional_numbers/@6,8',$q$
    SELECT (fractional_number_katex(ROW(6,8)::fractional_number)
              = split_part((SELECT katex FROM base_render_corpus WHERE family_path = 'fractional_numbers/@6,8'), ' ∈ ', 1))::text $q$),
  ('representations','colored_motzkin_path katex bars nothing but arrows the steps, matches the render-corpus oracle: UH0D and H1H1H1 (k=2,n=3)','eq','true','split_part(katex, '' ∈ '', 1) from two colored_motzkin_paths~k=2~n/3 corpus rows',$q$
    SELECT (colored_motzkin_path_katex(ROW(ARRAY[1,0,-1],ARRAY[-1,0,-1])::colored_motzkin_path)
              = split_part((SELECT katex FROM base_render_corpus WHERE family_path = 'colored_motzkin_paths~k=2~n/3@UH0D'), ' ∈ ', 1)
        AND colored_motzkin_path_katex(ROW(ARRAY[0,0,0],ARRAY[1,1,1])::colored_motzkin_path)
              = split_part((SELECT katex FROM base_render_corpus WHERE family_path = 'colored_motzkin_paths~k=2~n/3@H1H1H1'), ' ∈ ', 1))::text $q$);
