"""Verify all source entries are accounted for and original card IDs survive."""
import json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'pipeline/src'))
from vocab_pipeline.build import load_pack_file,to_app_content
report=json.loads((ROOT/'scripts/imports/import-report.json').read_text())
assert sorted(report['existing_ranks']+report['duplicate_ranks']+[x['rank'] for x in report['added']])==list(range(1,2001))
original=to_app_content([load_pack_file(p) for p in (ROOT/'content').glob('*/packs.json') if not p.parent.name.startswith('supplement-')])
updated=json.loads((ROOT/'app/build/content.json').read_text())
old={i['id']:i for p in original['packs'] for i in p['items']}
new={i['id']:i for p in updated['packs'] for i in p['items']}
assert all(new[k]==v for k,v in old.items())
assert len(new)==len(old)+report['added_count']==4616
assert len(new)==sum(len(p['items']) for p in updated['packs'])
print('PASS: all 2,000 PDF entries accounted for; 4,001 original cards unchanged; 615 new unique IDs.')
