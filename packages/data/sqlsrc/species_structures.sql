-- requires: species_kernel, permutations, set_partitions
-- species_structures — the GENERIC DEFINITIONAL enumerator (wiki Species-Data-Model.md §3d): every labelled
-- F-structure on a given label set, walking the SAME recursive-descent precedence as species_eval/species_z_eval
-- (strip parens → additive last +/- → multiplicative first · → composition first ∘ → power ^ → leaf). This is a
-- SLOW, EXACT floor/oracle (exponential; n small only) — deliberately NOT wired into run.mts. See selfcert-species.mts
-- (#274 B7).

-- ── small combinatorial helpers over an arbitrary int[] label set ──────────────────────────────────────
CREATE FUNCTION species_array_permutations(arr int[]) RETURNS SETOF int[] LANGUAGE plpgsql STABLE AS $$
  DECLARE n int := coalesce(array_length(arr,1),0); i int; rest int[]; sub int[];
  BEGIN
    IF n = 0 THEN RETURN QUERY SELECT ARRAY[]::int[]; RETURN; END IF;
    FOR i IN 1..n LOOP
      rest := arr[1:i-1] || arr[i+1:n];
      FOR sub IN SELECT * FROM species_array_permutations(rest) LOOP
        RETURN QUERY SELECT ARRAY[arr[i]] || sub;
      END LOOP;
    END LOOP;
  END $$;

-- every ordered split of labels into (A,B) — 2^n splits total; A or B may be empty.
CREATE FUNCTION species_label_splits(labels int[]) RETURNS TABLE(a int[], b int[]) LANGUAGE plpgsql STABLE AS $$
  DECLARE n int := coalesce(array_length(labels,1),0); m bigint; i int; sa int[]; sb int[];
  BEGIN
    FOR m IN 0..(power(2,n)::bigint - 1) LOOP
      sa := '{}'; sb := '{}';
      FOR i IN 1..n LOOP
        IF ((m >> (i-1)) & 1) = 1 THEN sa := sa || labels[i]; ELSE sb := sb || labels[i]; END IF;
      END LOOP;
      a := sa; b := sb; RETURN NEXT;
    END LOOP;
  END $$;

-- every set partition of labels into nonempty blocks, as a jsonb array of blocks (each a sorted int[] as jsonb),
-- blocks ordered ascending by their min element — an RGS-style build over the SORTED labels (mirrors
-- set_partitions' own floor), generalized from positions 1..n to arbitrary label values.
CREATE FUNCTION species_label_partitions(labels int[]) RETURNS SETOF jsonb LANGUAGE plpgsql STABLE AS $$
  DECLARE sorted int[] := ARRAY(SELECT unnest(labels) ORDER BY 1); n int := coalesce(array_length(sorted,1),0);
  BEGIN
    IF n = 0 THEN RETURN QUERY SELECT '[]'::jsonb; RETURN; END IF;
    RETURN QUERY
      WITH RECURSIVE build AS (
        SELECT ARRAY[0]::int[] AS rgs, 0 AS mx
        UNION ALL
        SELECT b.rgs || v, greatest(b.mx, v)
        FROM build b, generate_series(0, b.mx + 1) v
        WHERE array_length(b.rgs, 1) < n
      )
      SELECT jsonb_agg(blk ORDER BY blkmin)
      FROM (
        SELECT b.rgs, array_agg(sorted[i] ORDER BY sorted[i]) AS blk, min(sorted[i]) AS blkmin
        FROM build b, generate_subscripts(b.rgs, 1) i
        WHERE array_length(b.rgs, 1) = n
        GROUP BY b.rgs, b.rgs[i]
      ) t
      GROUP BY rgs;
  END $$;

-- substitute each label-leaf NUMBER in an F-structure (built over synthetic "block-key" labels) with the
-- G-structure jsonb a composition mapping assigned that key. Walks jsonb generically: a bare number is a label
-- leaf; an object with a 'tag' key is a sum tag (the 0/1 tag value is NOT a label — only 'of' recurses); an
-- object with an 'l' key is a product split (both sides recurse); an array recurses element-wise; anything else
-- (null, an already-resolved nested structure) passes through unchanged.
CREATE FUNCTION species_substitute(v jsonb, mapping jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE result jsonb;
  BEGIN
    CASE jsonb_typeof(v)
      WHEN 'number' THEN RETURN mapping -> (v::text);
      WHEN 'array' THEN
        SELECT coalesce(jsonb_agg(species_substitute(e, mapping)), '[]'::jsonb) INTO result FROM jsonb_array_elements(v) e;
        RETURN result;
      WHEN 'object' THEN
        IF v ? 'tag' THEN RETURN jsonb_build_object('tag', v -> 'tag', 'of', species_substitute(v -> 'of', mapping));
        ELSIF v ? 'l' THEN RETURN jsonb_build_object('l', species_substitute(v -> 'l', mapping), 'r', species_substitute(v -> 'r', mapping));
        ELSE RETURN v;
        END IF;
      ELSE RETURN v;   -- null / other scalars
    END CASE;
  END $$;

-- every mapping {blockkey_text: G-structure} across all blocks of a composition partition — the cartesian
-- product across blocks (one G-structure choice per block), keyed by each block's own least element.
CREATE FUNCTION species_compose_mappings(gexpr text, blocks jsonb) RETURNS SETOF jsonb LANGUAGE plpgsql STABLE AS $$
  DECLARE n int := jsonb_array_length(blocks); first_blk jsonb; rest jsonb; blockkey text; blockarr int[];
  BEGIN
    IF n = 0 THEN RETURN QUERY SELECT '{}'::jsonb; RETURN; END IF;
    first_blk := blocks -> 0;
    SELECT array_agg(x::int) INTO blockarr FROM jsonb_array_elements_text(first_blk) x;
    SELECT min(x)::text INTO blockkey FROM unnest(blockarr) x;
    SELECT coalesce(jsonb_agg(b), '[]'::jsonb) INTO rest FROM jsonb_array_elements(blocks) WITH ORDINALITY t(b, ord) WHERE ord > 1;
    RETURN QUERY
      SELECT restmap || jsonb_build_object(blockkey, gstruct)
      FROM species_structures(gexpr, blockarr) gstruct, species_compose_mappings(gexpr, rest) restmap;
  END $$;

-- ── species_structures(expr, labels) — every labelled F-structure on `labels` ───────────────────────────
CREATE FUNCTION species_structures(expr text, labels int[]) RETURNS SETOF jsonb LANGUAGE plpgsql STABLE AS $$
  DECLARE
    e text := btrim(expr); i int; depth int; ch text; enclosed boolean; apos int; k int;
    left_e text; right_e text; blockkeys int[]; least_lbl int; rest_lbls int[];
  BEGIN
    LOOP
      IF left(e, 1) <> '(' THEN EXIT; END IF;
      depth := 0; enclosed := true;
      FOR i IN 1..length(e) LOOP
        ch := substring(e FROM i FOR 1);
        IF ch = '(' THEN depth := depth + 1;
        ELSIF ch = ')' THEN depth := depth - 1;
          IF depth = 0 AND i < length(e) THEN enclosed := false; EXIT; END IF;
        END IF;
      END LOOP;
      IF enclosed THEN e := btrim(substring(e FROM 2 FOR length(e) - 2)); ELSE EXIT; END IF;
    END LOOP;

    -- additive: last top-level + or - ('+' right after 'E' is the E+ atom, not an operator)
    depth := 0; apos := 0;
    FOR i IN 1..length(e) LOOP
      ch := substring(e FROM i FOR 1);
      IF ch = '(' THEN depth := depth + 1;
      ELSIF ch = ')' THEN depth := depth - 1;
      ELSIF depth = 0 AND i > 1 AND (ch = '+' OR ch = '-')
            AND NOT (ch = '+' AND substring(e FROM i - 1 FOR 1) = 'E') THEN apos := i * (CASE ch WHEN '+' THEN 1 ELSE -1 END);
      END IF;
    END LOOP;
    IF apos <> 0 THEN
      IF apos < 0 THEN RAISE EXCEPTION 'species_structures: difference (-) has no structural enumeration (expr %)', e; END IF;
      RETURN QUERY
        SELECT jsonb_build_object('tag', 0, 'of', s) FROM species_structures(left(e, apos - 1), labels) s
        UNION ALL
        SELECT jsonb_build_object('tag', 1, 'of', s) FROM species_structures(substring(e FROM apos + 1), labels) s;
      RETURN;
    END IF;

    -- multiplicative: first top-level ·  (every split of labels into A⊔B, F on A, G on B)
    depth := 0;
    FOR i IN 1..length(e) LOOP
      ch := substring(e FROM i FOR 1);
      IF ch = '(' THEN depth := depth + 1;
      ELSIF ch = ')' THEN depth := depth - 1;
      ELSIF depth = 0 AND ch = '·' THEN
        left_e := left(e, i - 1); right_e := substring(e FROM i + 1);
        RETURN QUERY
          SELECT jsonb_build_object('l', lf, 'r', rg)
          FROM species_label_splits(labels) sp,
               LATERAL species_structures(left_e, sp.a) lf,
               LATERAL species_structures(right_e, sp.b) rg;
        RETURN;
      END IF;
    END LOOP;

    -- composition: first top-level ∘  (set partition of labels; G-structure per block; F on the block keys)
    depth := 0;
    FOR i IN 1..length(e) LOOP
      ch := substring(e FROM i FOR 1);
      IF ch = '(' THEN depth := depth + 1;
      ELSIF ch = ')' THEN depth := depth - 1;
      ELSIF depth = 0 AND ch = '∘' THEN
        left_e := left(e, i - 1); right_e := substring(e FROM i + 1);
        RETURN QUERY
          SELECT species_substitute(fstruct, mapping)
          FROM species_label_partitions(labels) part,
               LATERAL species_compose_mappings(right_e, part) mapping,
               LATERAL (SELECT array_agg(mn ORDER BY mn) AS keys FROM (
                          SELECT (SELECT min(x::int) FROM jsonb_array_elements_text(blk) x) AS mn
                          FROM jsonb_array_elements(part) blk) bk) bkk,
               LATERAL species_structures(left_e, coalesce(bkk.keys, ARRAY[]::int[])) fstruct;
        RETURN;
      END IF;
    END LOOP;

    -- power: top-level ^k (exponent an integer literal) — k-fold labelled product, right-nested
    depth := 0;
    FOR i IN 1..length(e) LOOP
      ch := substring(e FROM i FOR 1);
      IF ch = '(' THEN depth := depth + 1;
      ELSIF ch = ')' THEN depth := depth - 1;
      ELSIF ch = '^' AND depth = 0 THEN
        left_e := left(e, i - 1);
        k := btrim(substring(e FROM i + 1))::int;
        IF k < 0 THEN RAISE EXCEPTION 'species_structures: negative power %', k; END IF;
        IF k = 0 THEN
          IF coalesce(array_length(labels,1),0) = 0 THEN RETURN QUERY SELECT 'null'::jsonb; END IF;
          RETURN;
        ELSIF k = 1 THEN
          RETURN QUERY SELECT * FROM species_structures(left_e, labels);
          RETURN;
        ELSE
          RETURN QUERY
            SELECT jsonb_build_object('l', lf, 'r', rg)
            FROM species_label_splits(labels) sp,
                 LATERAL species_structures(left_e || '^' || (k - 1)::text, sp.a) lf,
                 LATERAL species_structures(left_e, sp.b) rg;
          RETURN;
        END IF;
      END IF;
    END LOOP;

    -- leaf
    e := btrim(e);
    IF e = 'Y' THEN RAISE EXCEPTION 'species_structures: fixpoint not supported'; END IF;
    IF e = '1' THEN
      IF coalesce(array_length(labels,1),0) = 0 THEN RETURN QUERY SELECT 'null'::jsonb; END IF;
      RETURN;
    END IF;
    IF e = 'X' THEN
      IF coalesce(array_length(labels,1),0) = 1 THEN RETURN QUERY SELECT to_jsonb(labels[1]); END IF;
      RETURN;
    END IF;
    IF e = 'E' THEN
      RETURN QUERY SELECT to_jsonb(ARRAY(SELECT unnest(labels) ORDER BY 1));
      RETURN;
    END IF;
    IF e = 'E+' THEN
      IF coalesce(array_length(labels,1),0) >= 1 THEN RETURN QUERY SELECT to_jsonb(ARRAY(SELECT unnest(labels) ORDER BY 1)); END IF;
      RETURN;
    END IF;
    IF e = 'L' THEN
      RETURN QUERY SELECT to_jsonb(p) FROM species_array_permutations(labels) p;
      RETURN;
    END IF;
    IF e = 'C' THEN
      IF coalesce(array_length(labels,1),0) = 0 THEN RETURN; END IF;
      SELECT min(x) INTO least_lbl FROM unnest(labels) x;
      SELECT ARRAY(SELECT x FROM unnest(labels) x WHERE x <> least_lbl) INTO rest_lbls;
      RETURN QUERY SELECT to_jsonb(ARRAY[least_lbl] || p) FROM species_array_permutations(rest_lbls) p;
      RETURN;
    END IF;
    IF left(e, 2) = 'E_' THEN
      k := substring(e FROM 3)::int;
      IF coalesce(array_length(labels,1),0) = k THEN RETURN QUERY SELECT to_jsonb(ARRAY(SELECT unnest(labels) ORDER BY 1)); END IF;
      RETURN;
    END IF;
    RAISE EXCEPTION 'species_structures: unknown atom %', e;
  END $$;

-- ── carrier codecs (#268): permutation ⇄ E∘C holdform, set_partition ⇄ E∘E+ holdform ────────────────────
-- E∘C holdform: a jsonb array of cycles, each cycle a jsonb array of labels starting at its least element and
-- following the permutation's action; cycles ordered ascending by least element (matches
-- permutation_cycle_species_notation's own ordering, and species_structures('E∘C', …)'s outer-E ordering).
CREATE FUNCTION permutation_to_holdform(p permutation) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := coalesce(array_length((p).image,1),0); seen boolean[] := array_fill(false, ARRAY[greatest(n,1)]);
          i int; j int; cyc int[]; cycles jsonb := '[]'::jsonb;
  BEGIN
    FOR i IN 1..n LOOP
      IF NOT seen[i] THEN
        j := i; cyc := '{}';
        LOOP
          seen[j] := true;
          cyc := cyc || j;
          j := (p).image[j];
          EXIT WHEN j = i;
        END LOOP;
        cycles := cycles || jsonb_build_array(to_jsonb(cyc));
      END IF;
    END LOOP;
    RETURN cycles;
  END $$;

CREATE FUNCTION permutation_from_holdform(h jsonb) RETURNS permutation LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE cyc jsonb; arr int[]; n int; image int[]; i int; k int;
  BEGIN
    IF h IS NULL OR jsonb_array_length(h) = 0 THEN RETURN ROW(ARRAY[]::int[])::permutation; END IF;
    SELECT max(x::int) INTO n FROM jsonb_array_elements(h) c, jsonb_array_elements_text(c) x;
    image := array_fill(0, ARRAY[n]);
    FOR cyc IN SELECT * FROM jsonb_array_elements(h) LOOP
      SELECT array_agg(x::int) INTO arr FROM jsonb_array_elements_text(cyc) x;
      k := coalesce(array_length(arr,1),0);
      FOR i IN 1..k LOOP
        image[arr[i]] := arr[(i % k) + 1];
      END LOOP;
    END LOOP;
    RETURN ROW(image)::permutation;
  END $$;

-- E∘E+ holdform: a jsonb array of blocks (each a sorted int[] as jsonb), blocks ordered ascending by their min
-- element — identical shape to species_label_partitions' own output (E+ blocks contribute their bare sorted
-- array; the outer E just orders them), so this codec IS that generic builder specialised to an RGS carrier.
CREATE FUNCTION set_partition_to_holdform(p set_partition) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(jsonb_agg(blk ORDER BY g), '[]'::jsonb)
  FROM (
    SELECT (p).rgs[i] AS g, jsonb_agg(i ORDER BY i) AS blk
    FROM generate_subscripts((p).rgs,1) i
    GROUP BY (p).rgs[i]
  ) s $$;

CREATE FUNCTION set_partition_from_holdform(h jsonb) RETURNS set_partition LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int; rgs int[]; blk jsonb; gidx int := 0; pos int;
  BEGIN
    IF h IS NULL OR jsonb_array_length(h) = 0 THEN RETURN ROW(ARRAY[]::int[])::set_partition; END IF;
    SELECT max(x::int) INTO n FROM jsonb_array_elements(h) b, jsonb_array_elements_text(b) x;
    rgs := array_fill(0, ARRAY[n]);
    FOR blk IN SELECT * FROM jsonb_array_elements(h) LOOP
      FOR pos IN SELECT x::int FROM jsonb_array_elements_text(blk) x LOOP
        rgs[pos] := gidx;
      END LOOP;
      gidx := gidx + 1;
    END LOOP;
    RETURN ROW(rgs)::set_partition;
  END $$;

-- ── examples (tiny, n ≤ 3 — the enumerator is exponential; NOT a substitute for selfcert-species.mts) ────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('species_structures','E∘C on {1,2,3}: 6 permutation structures (= 3!)','eq','6','definitional enumerator vs the labelled-count formula',$q$
    SELECT count(*)::text FROM species_structures('E∘C', ARRAY[1,2,3]) $q$),
  ('species_structures','E∘E+ on {1,2,3}: 5 set-partition structures (= Bell(3))','eq','5','definitional enumerator vs Bell numbers',$q$
    SELECT count(*)::text FROM species_structures('E∘E+', ARRAY[1,2,3]) $q$),
  ('species_structures','E·E on {1,2}: 4 structures (= 2^2)','eq','4','every label-split, one E-structure per side',$q$
    SELECT count(*)::text FROM species_structures('E·E', ARRAY[1,2]) $q$);
