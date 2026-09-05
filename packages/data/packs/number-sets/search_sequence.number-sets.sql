-- requires: search_sequence, square_free_numbers
-- number-sets half of sqlsrc/search_sequence.sql's example set (#283 phase 3 extraction) — the offset-tolerance
-- check pastes a mid-sequence run of square_free_numbers, a number-sets collection.

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('search_sequence','a mid-sequence paste still matches — offset tolerance is free from the contiguous search','eq','5',
   'square_free_numbers starts 1,2,3,5,6,7,10,11,13,14; pasting from the 6-th term (0-based offset 5) lands at offset 5',$q$
    SELECT offset_index::text FROM search_sequence(ARRAY[7,10,11,13,14]) WHERE collection = 'square_free_numbers' $q$);
