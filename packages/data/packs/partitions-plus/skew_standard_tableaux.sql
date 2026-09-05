-- requires: skew_partitions, standard_tableaux, realizer, utilities
-- skew_standard_tableaux — standard tableaux on REDUCED skew shapes λ/μ with n cells (Sage `StandardSkewTableaux`),
-- summed over every reduced skew shape of n — same "sum over all shapes" pattern as standard_tableaux(n) itself.
-- Carrier: a small composite that PAIRS the existing skew_partition shape fields with a row_word filling (audit
-- §3.2 — no bespoke carrier when a sibling's fits; here the sibling is skew_partitions' own (lam,mu) pair, not
-- standard_tableau, because unlike the shifted case the row's LEFT offset (μ_r) genuinely isn't recoverable from
-- row assignment alone — it varies shape to shape, so it has to be carried).
--
-- The floor drives skew_partitions(n)'s own floor for the shape, then fills each fixed shape by the same kind of
-- ballot recursion as standard_tableaux/shifted_standard_tableaux: entries 1..n are placed one at a time into the
-- next open (leftmost) cell of some row r, legal iff the cell directly above (row r−1, same absolute column) is
-- either outside the shape or already filled — the general column-strictness check, of which the straight and
-- shifted floors are the μ=0 and μ_r=r−1 special cases.

-- ── carrier ────────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE skew_tableau AS (lam int[], mu int[], row_word int[]);   -- shape (as skew_partition) + row_word[i] = 0-based row of entry i
CREATE FUNCTION notation(t skew_tableau) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH rows AS (
    SELECT (t).row_word[i] r, string_agg(i::text, ',' ORDER BY i) vals
    FROM generate_subscripts((t).row_word,1) i GROUP BY (t).row_word[i]
  )
  SELECT coalesce(string_agg(
    CASE WHEN coalesce((t).mu[r+1],0) > 0 THEN repeat('.,', coalesce((t).mu[r+1],0)) || vals ELSE vals END,
    '/' ORDER BY r), '') FROM rows $$;

-- fillings of a FIXED skew shape (lam,mu), 1-indexed rows — the shared engine behind the floor and the examples.
CREATE FUNCTION skew_tableau_fillings(lam int[], mu int[], element_limit int) RETURNS SETOF int[] LANGUAGE sql STABLE AS $$
  WITH RECURSIVE build AS (
    SELECT ARRAY[]::int[] AS w, array_fill(0, ARRAY[coalesce(array_length(lam,1),0)])::int[] AS counts
    UNION ALL
    SELECT b.w || (r-1), b.counts[1:r-1] || (b.counts[r]+1) || b.counts[r+1:]
      FROM build b, LATERAL generate_series(1, coalesce(array_length(lam,1),0)) r
     WHERE b.counts[r] < lam[r] - coalesce(mu[r],0)                                          -- row r not yet full
       AND ( r = 1                                                                            -- top row: no cell above
             OR (coalesce(mu[r],0) + b.counts[r] + 1) <= coalesce(mu[r-1],0)                  -- above column is outside row r−1
             OR (coalesce(mu[r],0) + b.counts[r] + 1) > lam[r-1]                               -- ditto, other side
             OR b.counts[r-1] >= (coalesce(mu[r],0) + b.counts[r] + 1) - coalesce(mu[r-1],0) ) -- or already filled
  )
  SELECT w FROM build
   WHERE coalesce(array_length(w,1),0) = (SELECT coalesce(sum(x),0) FROM unnest(lam) x) - (SELECT coalesce(sum(x),0) FROM unnest(mu) x)
   ORDER BY w
   LIMIT element_limit $$;

-- ── the engines a collection provides ──────────────────────────────────────────────────────────────────
CREATE TYPE skew_standard_tableaux_fiber AS (size natural_number);   -- typed fiber; axis: size
CREATE FUNCTION fiber_elements(f skew_standard_tableaux_fiber, element_limit int) RETURNS SETOF skew_tableau LANGUAGE sql STABLE AS $$
  SELECT ROW(((se).value).lam, ((se).value).mu, w)::skew_tableau
  FROM elements(skew_partitions((f).size), element_limit) se,
       LATERAL skew_tableau_fillings(((se).value).lam, ((se).value).mu, element_limit) w
  ORDER BY ((se).value).lam, ((se).value).mu, w
  LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f skew_standard_tableaux_fiber, v skew_tableau) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE lam int[] := (v).lam; mu int[] := (v).mu; w int[] := (v).row_word;
          l int := coalesce(array_length(lam,1),0); counts int[]; i int; r int; newcol int;
  BEGIN
    IF NOT contains(skew_partitions((f).size), ROW(lam,mu)::skew_partition) THEN RETURN false; END IF;
    IF coalesce(array_length(w,1),0) <> (f).size::int THEN RETURN false; END IF;
    IF l = 0 THEN RETURN (f).size::int = 0; END IF;
    counts := array_fill(0, ARRAY[l]);
    FOR i IN 1..array_length(w,1) LOOP
      r := w[i] + 1;
      IF r < 1 OR r > l THEN RETURN false; END IF;
      IF counts[r] >= lam[r] - coalesce(mu[r],0) THEN RETURN false; END IF;                    -- row r already full
      newcol := coalesce(mu[r],0) + counts[r] + 1;
      IF r > 1 AND newcol > coalesce(mu[r-1],0) AND newcol <= lam[r-1] THEN
        IF counts[r-1] < newcol - coalesce(mu[r-1],0) THEN RETURN false; END IF;                -- cell above not yet filled
      END IF;
      counts[r] := counts[r] + 1;
    END LOOP;
    RETURN true;
  END $$;

-- ── declare as DATA + realize ──────────────────────────────────────────────────────────────────────────
INSERT INTO base_collection VALUES ('skew_standard_tableaux', 'skew_tableau');
INSERT INTO base_grade VALUES ('skew_standard_tableaux', 1, 'size', NULL, NULL);
SELECT base_realize('skew_standard_tableaux');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('skew_standard_tableaux','anchor: |skew_standard_tableaux(n)| for n=0..5 is 1,1,4,24,194,1960','eq','1,1,4,24,194,1960','summed over every reduced skew shape of n',$q$
    SELECT string_agg(cardinality(skew_standard_tableaux(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('skew_standard_tableaux','notation renders the skew offset with dots: (2,1)/(1) filled row0=2, row1=1 prints .,2/1','eq','.,2/1','one blank cell before row 0''s entry',$q$
    SELECT notation(ROW(ARRAY[2,1], ARRAY[1], ARRAY[1,0])::skew_tableau) $q$),
  ('skew_standard_tableaux','the disconnected shape (2,1)/(1) with 2 cells has BOTH fillings (no column links the two singleton rows)','eq','.,1/2|.,2/1','row0 and row1 occupy different columns entirely',$q$
    SELECT string_agg(render(e), '|' ORDER BY ordinality(e)) FROM elements(skew_standard_tableaux(2)) e
    WHERE render(e) LIKE '.,%' $q$),
  ('skew_standard_tableaux','contains via <@: a straight-shape filling with mu=empty is a member; a filling with a full row is not','eq','true|false','the column-strictness replay',$q$
    SELECT (ROW(ARRAY[2], ARRAY[]::int[], ARRAY[0,0])::skew_tableau <@ skew_standard_tableaux(2))::text || '|' ||
           (ROW(ARRAY[1], ARRAY[]::int[], ARRAY[0,0,0])::skew_tableau <@ skew_standard_tableaux(2))::text $q$),
  ('skew_standard_tableaux','every element''s shape sums to n (|λ|−|μ| = n), for n=0..4','eq','true','the defining invariant',$q$
    SELECT bool_and((SELECT coalesce(sum(x),0) FROM unnest(((e).value).lam) x) -
                    (SELECT coalesce(sum(x),0) FROM unnest(((e).value).mu) x) = n)::text
    FROM generate_series(0,4) n, LATERAL elements(skew_standard_tableaux(n)) e $q$),
  ('skew_standard_tableaux','a straight shape (μ empty) recovers exactly the standard_tableaux count for that n, since it is one shape among many','eq','true','skew_standard_tableaux(n) ⊇ the straight-shape SYT (a sub-count), for n=0..4',$q$
    SELECT bool_and(cardinality(skew_standard_tableaux(n)) >= cardinality(standard_tableaux(n)))::text
    FROM generate_series(0,4) n $q$),
  ('skew_standard_tableaux','range constructor skew_standard_tableaux(0,3): fibers unfold to sizes 0,1,2,3','eq','0,1,2,3','the (lo,hi) range form',$q$
    SELECT string_agg((f).size::text, ',' ORDER BY (f).size) FROM fibers(skew_standard_tableaux(0,3)) f $q$);
