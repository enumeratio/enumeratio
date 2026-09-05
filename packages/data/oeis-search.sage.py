# OEIS candidate search — reads oeis-discover.mts's output (cardinality sequences for collections with no existing
# base_reference row), reverse-searches each via Sage's live oeis() interface, and prints candidate A-number matches
# for human review. Nothing here is written back to base_reference automatically — verify each candidate (does the
# OEIS formula/offset genuinely match this collection's definition?) before adding it as a base_reference row.
#
#   sage oeis-search.sage.py [in.json] [out.json]
import json
import sys
from sage.all import oeis

in_path = sys.argv[1] if len(sys.argv) > 1 else '../../.scratch/oeis-discover.json'
out_path = sys.argv[2] if len(sys.argv) > 2 else '../../.scratch/oeis-candidates.json'

with open(in_path) as f:
    sequences = json.load(f)

print(f"{len(sequences)} sequences to search\n")

candidates = []
for entry in sequences:
    cid = entry['id']
    terms = [int(t) for t in entry['terms']]
    try:
        matches = oeis(terms)
    except Exception as e:
        print(f"  {cid}: SEARCH FAILED ({e})")
        continue
    if not matches:
        print(f"  {cid}: no match  terms={terms}")
        continue
    top = matches[:5]
    print(f"  {cid}  terms={terms}  offset={entry['offset']}")
    for m in top:
        print(f"      {m.id()}  {m.name()}")
    candidates.append({
        'id': cid,
        'terms': entry['terms'],
        'offset': entry['offset'],
        'matches': [{'a_number': m.id(), 'name': m.name()} for m in top],
    })

with open(out_path, 'w') as f:
    json.dump(candidates, f, indent=2)

print(f"\nwrote {len(candidates)} candidate rows to {out_path}")
