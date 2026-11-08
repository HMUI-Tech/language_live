"""Import the supplied frequency list without changing existing card IDs.

Input is table-extracted JSON. Page-break continuation rows are rejoined.
Matching preserves noun/verb differences and normalizes articles and verb forms.
Supplement levels are frequency bands for navigation, not certified CEFR labels.
"""
import json,re,unicodedata
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def head(raw):
    raw=unicodedata.normalize('NFC',raw).strip()
    raw=raw.split(',')[0].strip()
    article=re.match(r'^(der|die|das)\s+',raw)
    art=article.group(1) if article else None
    if article: raw=raw[article.end():]
    raw=re.sub(r'\s*\([^)]*\)','',raw).strip()
    return raw,art

def key(word,art=None):
    word,found=head(word)
    # Nominalised verbs (das Essen) remain distinct from verbs (essen).
    noun=bool(art or found)
    return re.sub(r'\s+',' ',word.casefold()).strip(),noun

rows=[]
for row in json.loads((ROOT/'scripts/imports/pdf-words.json').read_text()):
    if not row['english']:
        assert not row['example'] and rows
        rows[-1]['german']+=' '+row['german']
    else: rows.append(row.copy())
assert len(rows)==2000,len(rows)
existing={}
for path in sorted((ROOT/'content').glob('*/packs.json')):
    if path.parent.name.startswith('supplement-'):continue
    for pack in json.loads(path.read_text())['packs']:
        for item in pack['items']: existing.setdefault(key(item['de'],item.get('art')),item)
seen=set(existing); added=[]; matched=[]; duplicate=[]
for rank,row in enumerate(rows,1):
    de,art=head(row['german'])
    # Combined variants are one entry; retain them as a phrase if not already present.
    variants=[s.strip() for s in de.split('/')]
    k=key(de,art)
    if k in seen or all(key(v,art) in seen for v in variants):
        (matched if k in existing or all(key(v,art) in existing for v in variants) else duplicate).append(rank)
        continue
    if len(variants)>1:
        de=' / '.join(v for v in variants if key(v,art) not in seen)
        k=key(de,art)
    item={'de':de,'en':row['english'],'pos':'noun' if art else ('verb' if ',' in row['german'] else 'other')}
    if art:item['art']=art
    assert len(de)<=60 and len(item['en'])<=80,(rank,item)
    seen.add(k);added.append({'rank':rank,'page':row['page'],'item':item,'source_example':row['example']})
levels={'A1':[],'A2':[],'B1':[],'B2':[]}
for entry in added:
    level=['A1','A2','B1','B2'][min((entry['rank']-1)//500,3)]
    levels[level].append(entry)
for level,entries in levels.items():
    packs=[]
    # Keep stable rank-derived IDs even if import rules change in a future release.
    for i in range(0,len(entries),40):
        chunk=entries[i:i+40]
        if len(chunk)<5 and packs:
            packs[-1]['items'].extend(x['item'] for x in chunk); continue
        packs.append({'slug':f'pdf-supplement-{level.lower()}-{i//40+1:02}', 'kind':'core','title':f'Zusatzwortschatz {i//40+1}', 'title_en':'Missing words from your 2,000-word PDF','week':{'A1':6,'A2':12,'B1':19,'B2':26}[level], 'items':[x['item'] for x in chunk]})
    path=ROOT/'content'/f'supplement-{level.lower()}'/'packs.json';path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps({'level':level,'version':'0.4.0','source':'User-supplied onewholearns.com top-2000 German frequency PDF. Levels are frequency-based navigation bands, not assessed CEFR.','packs':packs},ensure_ascii=False,indent=2))
report={'pdf_rows':len(rows),'existing_matches':len(matched),'duplicate_pdf_entries_skipped':len(duplicate),'added_count':len(added),'added':added,'existing_ranks':matched,'duplicate_ranks':duplicate}
(ROOT/'scripts/imports/import-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
assert len(matched)+len(duplicate)+len(added)==2000
print({k:v for k,v in report.items() if not isinstance(v,list)})
print('First added:',[x['item']['de'] for x in added[:30]])
