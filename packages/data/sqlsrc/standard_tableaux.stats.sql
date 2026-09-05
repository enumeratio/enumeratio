-- requires: standard_tableaux, integer_partitions, realizer, utilities
-- standard_tableaux statistics + maps: shape data of the SYT (rows/columns of λ), the descent statistics
-- (descents St000157, major index St000330), the shape MAP → integer_partitions, and the transpose MAP (an
-- involution → standard_tableaux, conjugating the shape). row_word[i] = 0-based row of entry i (i 1-based).

-- ── statistics (carrier standard_tableau) ──────────────────────────────────────────────────────────────
-- number of rows = max row index + 1 = number of parts of the shape λ.
CREATE FUNCTION standard_tableau_rows(x standard_tableau) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT max(r) FROM unnest((x).row_word) r), -1) + 1 $$;

-- number of columns = λ_1 = length of the (longest) first row = #cells in row 0.
CREATE FUNCTION standard_tableau_columns(x standard_tableau) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM unnest((x).row_word) r WHERE r = 0 $$;

-- descents: i (1 ≤ i < n) is a descent iff i+1 sits in a strictly lower row than i (row_word[i+1] > row_word[i]).
CREATE FUNCTION standard_tableau_descents(x standard_tableau) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((x).row_word,1) i
   WHERE i < array_length((x).row_word,1) AND (x).row_word[i+1] > (x).row_word[i] $$;

-- major index: sum of the descent positions i.
CREATE FUNCTION standard_tableau_major_index(x standard_tableau) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(sum(i),0)::int FROM generate_subscripts((x).row_word,1) i
   WHERE i < array_length((x).row_word,1) AND (x).row_word[i+1] > (x).row_word[i] $$;

-- ── maps ────────────────────────────────────────────────────────────────────────────────────────────────
-- shape: the row lengths (#cells per row value), as a non-increasing integer partition (λ ⊢ n).
CREATE FUNCTION standard_tableau_shape(x standard_tableau) RETURNS integer_partition LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(SELECT count(*)::int FROM unnest((x).row_word) r GROUP BY r ORDER BY count(*) DESC))::integer_partition $$;

-- transpose: reflect the tableau across its main diagonal (a SYT of the conjugate shape; an involution). The
-- new row of entry i is its 0-based COLUMN in x, i.e. #{ j ≤ i : row_word[j] = row_word[i] } − 1.
CREATE FUNCTION standard_tableau_transpose(x standard_tableau) RETURNS standard_tableau LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(
    SELECT (SELECT count(*)::int FROM generate_subscripts((x).row_word,1) j
             WHERE j <= i AND (x).row_word[j] = (x).row_word[i]) - 1
    FROM generate_subscripts((x).row_word,1) i ORDER BY i))::standard_tableau $$;

-- ── register in base_stat / base_map ────────────────────────────────────────────────────────────────────
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('standard_tableaux','rows','standard_tableau_rows','Number of rows','natural_numbers'),
  ('standard_tableaux','columns','standard_tableau_columns','Number of columns','natural_numbers'),
  ('standard_tableaux','descents','standard_tableau_descents','Descents','natural_numbers'),
  ('standard_tableaux','major_index','standard_tableau_major_index','Major index','natural_numbers');

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('standard_tableaux','shape','standard_tableau_shape','integer_partitions','Shape',NULL),
  ('standard_tableaux','transpose','standard_tableau_transpose','standard_tableaux','Transpose',NULL);

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('standard_tableaux','rows: distribution over standard_tableaux(3) is 1,2,1','eq','1,2,1','1/2/3 rows among the 4 SYT of size 3',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT standard_tableau_rows((e).value) k, count(*) c
      FROM elements(standard_tableaux(3)) e GROUP BY 1) t(k,c) $q$),
  ('standard_tableaux','rows: column 1/2/3 has 3 rows, row 1,2,3 has 1','eq','3|1','max row index + 1',$q$
    SELECT standard_tableau_rows(ROW(ARRAY[0,1,2])::standard_tableau)::text || '|' ||
           standard_tableau_rows(ROW(ARRAY[0,0,0])::standard_tableau)::text $q$),
  ('standard_tableaux','columns: row 1,2,3 has 3 cols, column 1/2/3 has 1, 1,3/2 has 2','eq','3|1|2','λ_1 = #cells in row 0',$q$
    SELECT standard_tableau_columns(ROW(ARRAY[0,0,0])::standard_tableau)::text || '|' ||
           standard_tableau_columns(ROW(ARRAY[0,1,2])::standard_tableau)::text || '|' ||
           standard_tableau_columns(ROW(ARRAY[0,1,0])::standard_tableau)::text $q$),
  ('standard_tableaux','columns and rows sum equally over a fiber (transpose is a bijection): both 8 over size 3','eq','8|8','Σλ_1 = Σℓ(λ) via conjugation',$q$
    SELECT (SELECT sum(standard_tableau_columns((e).value)) FROM elements(standard_tableaux(3)) e)::text || '|' ||
           (SELECT sum(standard_tableau_rows((e).value)) FROM elements(standard_tableaux(3)) e)::text $q$),
  ('standard_tableaux','descents: distribution over standard_tableaux(4) is the symmetric 1,4,4,1','eq','1,4,4,1','#SYT of size 4 by descent count (sums to T(4)=10)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT standard_tableau_descents((e).value) k, count(*) c
      FROM elements(standard_tableaux(4)) e GROUP BY 1) t(k,c) $q$),
  ('standard_tableaux','descents: column 1/2/3 has 2, row 1,2,3 has 0','eq','2|0','i is a descent iff i+1 is lower',$q$
    SELECT standard_tableau_descents(ROW(ARRAY[0,1,2])::standard_tableau)::text || '|' ||
           standard_tableau_descents(ROW(ARRAY[0,0,0])::standard_tableau)::text $q$),
  ('standard_tableaux','major_index: over standard_tableaux(3) the maj values are exactly 0,1,2,3','eq','1,1,1,1','each maj in {0,1,2,3} occurs once',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT standard_tableau_major_index((e).value) k, count(*) c
      FROM elements(standard_tableaux(3)) e GROUP BY 1) t(k,c) $q$),
  ('standard_tableaux','major_index: column 1/2/3 has maj 3 (descents 1+2), 1,2/3 has maj 2','eq','3|2','sum of descent positions',$q$
    SELECT standard_tableau_major_index(ROW(ARRAY[0,1,2])::standard_tableau)::text || '|' ||
           standard_tableau_major_index(ROW(ARRAY[0,0,1])::standard_tableau)::text $q$),
  ('standard_tableaux','shape: the shapes over standard_tableaux(3), in rank order','eq','3,2+1,2+1,1+1+1','row-length partition of each of the 4 SYT of size 3',$q$
    SELECT string_agg(render_value(standard_tableau_shape((e).value)), ',' ORDER BY ordinality(e))
      FROM elements(standard_tableaux(3)) e $q$),
  ('standard_tableaux','shape: 1,3/2 ↦ 2+1, and the row 1,2,3 ↦ 3','eq','2+1|3','row lengths as an integer partition',$q$
    SELECT notation(standard_tableau_shape(ROW(ARRAY[0,1,0])::standard_tableau)) || '|' ||
           notation(standard_tableau_shape(ROW(ARRAY[0,0,0])::standard_tableau)) $q$),
  ('standard_tableaux','transpose: the row 1,2,3 ↦ the column 1/2/3, and the column ↦ the row','eq','1/2/3|1,2,3','reflect across the diagonal (row↔column duality)',$q$
    SELECT notation(standard_tableau_transpose(ROW(ARRAY[0,0,0])::standard_tableau)) || '|' ||
           notation(standard_tableau_transpose(ROW(ARRAY[0,1,2])::standard_tableau)) $q$),
  ('standard_tableaux','transpose: 1,3/2 ↦ 1,2/3, and it is an involution (back to 1,3/2)','eq','1,2/3|1,3/2','T ↦ T^t ↦ T',$q$
    SELECT notation(standard_tableau_transpose(ROW(ARRAY[0,1,0])::standard_tableau)) || '|' ||
           notation(standard_tableau_transpose(standard_tableau_transpose(ROW(ARRAY[0,1,0])::standard_tableau))) $q$),
  ('standard_tableaux','transpose is an involution across all of standard_tableaux(4)','eq','true','(T^t)^t = T for every SYT of size 4',$q$
    SELECT bool_and(notation(standard_tableau_transpose(standard_tableau_transpose((e).value)))
                    = notation((e).value))::text FROM elements(standard_tableaux(4)) e $q$),
  ('standard_tableaux','the registry lists at least the known standard_tableaux stats and maps (a floor — more may be added)','eq','true|true','base_stat / base_map rows',$q$
    SELECT (SELECT array_agg(stat_id) @> ARRAY['columns','descents','major_index','rows'] FROM base_stat WHERE collection = 'standard_tableaux')::text || '|' ||
           (SELECT array_agg(map_id)  @> ARRAY['shape','transpose']            FROM base_map  WHERE collection = 'standard_tableaux')::text $q$);