"""Build spelling-similar, dictionary-attested word bridges from Ding 1.9.
Usage: python scripts/content/build-word-bridges.py /path/to/de-en.txt.gz
Dictionary-derived output is GPL-2.0-or-later; see public/data/word-bridges-NOTICE.txt.
"""
import gzip,json,re,sys,unicodedata
from pathlib import Path
from difflib import SequenceMatcher
root=Path(__file__).resolve().parents[2]
def norm(x):
 return ''.join(c for c in unicodedata.normalize('NFKD',x.lower().replace('ß','ss')) if not unicodedata.combining(c))
def clean(x):
 x=re.sub(r'\{[^}]*\}|\[[^]]*\]|\([^)]*\)|<[^>]*>','',x).strip()
 return re.sub(r'^to ','',x)
candidates={}
for line in gzip.open(sys.argv[1],'rt'):
 if line.startswith('#') or ' :: ' not in line: continue
 # Base forms only: never inflate the count with the plural/inflected columns.
 de,en=line.rstrip().split(' :: ',1);de=de.split(' | ')[0];en=en.split(' | ')[0]
 if any(x in de.lower() for x in ['[vulg','[obs','[offens','[pej','[derog','[slur','[zool','[bot','{pl}','[archa','[hist','[relig','[mil.']):continue
 for d in de.split(';'):
  word=clean(d)
  if not re.fullmatch(r'[A-Za-zÄÖÜäöüß]{4,24}',word):continue
  gender=re.search(r'\{([mfn])\}',d)
  if word[0].isupper() and not gender:continue # names, acronyms and unannotated plurals
  for e in en.split(';'):
   target=clean(e)
   if not re.fullmatch(r'[a-zA-Z]{4,24}',target) or target.isupper():continue
   a,b=norm(word),norm(target)
   score=SequenceMatcher(None,a,b).ratio()
   # A translated meaning must exist on the same dictionary line; spelling alone never supplies a translation.
   if a[0]!=b[0] or score<.80:continue
   if min(len(a),len(b))<6 and score<.85:continue
   display=({'m':'der ','f':'die ','n':'das '}[gender[1]] if gender else '')+word
   row=[display,target,'Dictionary','','','ungraded']
   key=word.lower()
   if key not in candidates or score>candidates[key][0]:candidates[key]=(score,row)
# Prefer closest spelling; deterministic secondary order, one base headword per row.
rows=[r for score,r in sorted(candidates.values(),key=lambda t:(-t[0],t[1][0]))]
Path('/tmp/bridge-candidates.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
print('Candidates:',len(rows));print(json.dumps(rows[::max(1,len(rows)//35)],ensure_ascii=False))
# Rank dictionary candidates by usage frequency rather than alphabetical technical terms.
# Build-only dependency: wordfreq 3.1.1. No frequency tables are distributed.
from wordfreq import zipf_frequency
html=(root/'public/learn.html').read_text()
# Existing editorial rows are emitted separately by the build harness.
existing=json.loads((root/'public/data/editorial-bridges.json').read_text())
seen={re.sub(r'^(der|die|das) ','',r[0]) for r in existing}
blocked={'sexual','sexuell','porn','porno','penis','vagina','fuck','ficken','nazi','hitler','holocaust','terror','suizid','suicide','homo','hetero','fetisch','fetish','erotik','erotic','masturb','rass','racis'}
ranked=[]
for r in rows:
 word=re.sub(r'^(der|die|das) ','',r[0]);en=r[1]
 if word in seen or any(t in (word+' '+en).lower() for t in blocked):continue
 # Exclude proper names; preserve normal lower-case English common nouns.
 if en[0].isupper():continue
 rank=min(zipf_frequency(word,'de'),zipf_frequency(en,'en'))
 if rank<2:continue
 ranked.append((rank,r))
ranked.sort(key=lambda t:(-t[0],t[1][0]))
selected=[r for _,r in ranked[:4000-len(existing)]]
assert len(selected)+len(existing)==4000, len(ranked)
(root/'public/data/word-bridges.json').write_text(json.dumps(selected,ensure_ascii=False,separators=(',',':'))+'\n')
print('Selected',len(selected),'dictionary rows; total',len(selected)+len(existing))
print('Sample:',json.dumps(selected[::150],ensure_ascii=False))
