"""Build dictionary cards with gender and plural from Wiktionary via Kaikki.
Input JSONL: https://kaikki.org/dictionary/Italian/kaikki.org-dictionary-Italian.jsonl
Wiktionary text CC BY-SA 4.0. Build-only wordfreq==3.1.1.
"""
import json,re,sys,unicodedata,gzip
from pathlib import Path
from difflib import SequenceMatcher
from wordfreq import zipf_frequency
r=Path(__file__).resolve().parents[2];entries={};bridges={};sources={}
def norm(x):return ''.join(c for c in unicodedata.normalize('NFKD',x.lower()) if not unicodedata.combining(c))
def art(w,g):
 if w[0] in 'aeiouàèéìòù':return "l'"
 return 'la' if g=='feminine' else 'lo' if re.match(r'^(z|gn|ps|pn|x|y|s[^aeiou])',w) else 'il'
def full(row):
 a=row.get('art','');return a+('' if a.endswith("'") or not a else ' ')+row['de']
blocked=('penis','vagina','fuck','cunt','nigger','nazi','hitler','porn','masturb','suicid','sessual','sexual','prostitut','negro','fascis','holocaust','terroris','orgasm','erotic','erotico','fetish','fetisc','razzis','racis')
for line in open(sys.argv[1]):
 x=json.loads(line);w=x.get('word','');pos=x.get('pos');freq=zipf_frequency(w,'it')
 if x.get('lang_code')!='it' or not re.fullmatch(r'[a-zàèéìòù]{3,24}',w) or pos not in ['noun','verb','adj','adv','prep','conj','pron','num','intj'] or freq<1.8:continue
 senses=[ss for ss in x.get('senses',[]) if not ss.get('form_of') and not ss.get('alt_of') and not set(ss.get('tags',[]))&{'form-of','obsolete','archaic','vulgar','offensive','derogatory','slur','plural'}]
 if not senses:continue
 tags=set(x.get('tags',[]))|set(senses[0].get('tags',[]));gender='feminine' if 'feminine' in tags else 'masculine' if 'masculine' in tags else None
 if pos=='noun' and not gender:continue
 glosses=[g for ss in senses for g in ss.get('glosses',[]) if len(g)<130]
 if not glosses:continue
 if any(t in (w+' '+' '.join(glosses)).lower() for t in blocked):continue
 row={'de':w,'en':glosses[0],'pos':pos,'source':'https://en.wiktionary.org/wiki/'+w+'#Italian'}
 if pos=='noun':
  row['art']=art(w,gender)
  plural=next((f['form'] for f in x.get('forms',[]) if f.get('tags')==['plural'] and re.fullmatch(r'[a-zàèéìòù]{2,25}',f['form'])),None)
  if plural:row['pl']=('le ' if gender=='feminine' else 'gli ' if art(w,gender) in ['lo',"l'"] else 'i ')+plural
 # Keep the first ordinary sense for cards; alternate base-word parts of speech do not inflate counts.
 if w not in entries:entries[w]=(freq,row);sources[w]=x
 for g in glosses:
  g=re.sub(r'\([^)]*\)','',g).strip()
  for en in re.split(r'[,;]',g):
   en=en.strip().removeprefix('a ').removeprefix('an ').removeprefix('to ')
   if not re.fullmatch(r'[a-z]{3,25}',en):continue
   score=SequenceMatcher(None,norm(w),norm(en)).ratio()
   if score>=.68 and norm(w)[0]==norm(en)[0] and (w not in bridges or score>bridges[w][0]):bridges[w]=(score,freq,[full(row),en,'Dictionary','','','ungraded']);sources[w]=x
ranked=sorted(entries.values(),key=lambda a:(-a[0],a[1]['de']))
content=json.loads((r/'public/content.json').read_text());packs=[p for p in content['packs'] if p.get('dialogue')]
for i in range(0,4000,40):
 idx=i//40;level='A1' if i<800 else 'A2' if i<1700 else 'B1' if i<2900 else 'B2';week=min(26,1+int(idx/100*26));items=[dict(row,id=f'core-{idx+1}.{n+1}') for n,(_,row) in enumerate(ranked[i:i+40])]
 packs.append({'id':f'core-{idx+1:03}','kind':'vocabulary','level':level,'week':week,'title':f'Vocabolario {idx+1}','title_en':f'Vocabulary {idx+1} · frequency band','items':items})
content['packs']=sorted(packs,key=lambda p:(p['week'],p['kind']!='situation',p['id']));(r/'public/content.json').write_text(json.dumps(content,ensure_ascii=False,separators=(',',':')))
ui_path=r/'public/learning-app.js' if (r/'public/learning-app.js').exists() else r/'public/learn.html'
html=ui_path.read_text();start=html.index('window.DLGuides = ')+len('window.DLGuides = ');end=html.index(';\n</script>',start);guides=json.loads(html[start:end]);head=lambda x:re.sub(r"^(?:il |lo |la |l'|i |gli |le )",'',x);seen={head(row[0]) for row in guides['pairs']}
new=[row for score,freq,row in sorted(bridges.values(),key=lambda a:(-a[1],-a[0],a[2][0])) if head(row[0]) not in seen][:3960]
print('Kaikki base forms',len(entries),'bridge candidates',len(bridges),'selected',len(new))
assert len(new)>=2960
(r/'public/data/word-bridges.json').write_text(json.dumps(new,ensure_ascii=False,separators=(',',':')))
html=re.sub(r'(<script[^>]*id="dl-content"[^>]*>)[\s\S]*?(</script>)',lambda m:m[1]+json.dumps(content,ensure_ascii=False,separators=(',',':'))+m[2],html,count=1)
html=html.replace('rows.length !== 2988','rows.length !== '+str(len(new))).replace('3,028 word pairs available · 40 with original example sentences; 2,988 dictionary-derived spelling matches.',f'{len(new)+40:,} word pairs available · 40 with original example sentences; {len(new):,} dictionary-derived spelling matches.').replace('Dictionary source: FreeDict/WikDict 2025.11.23, from Wiktionary via DBnary, CC BY-SA 3.0.','Dictionary source: Wiktionary contributors via Kaikki/Wiktextract, CC BY-SA 4.0.')
ui_path.write_text(html)
selected={row['de'] for _,row in ranked[:4000]}|{head(row[0]) for row in new}
with gzip.open(r/'public/data/italian-selected-source.jsonl.gz','wt') as f:
 for w in sorted(selected):f.write(json.dumps(sources[w],ensure_ascii=False,separators=(',',':'))+'\n')
print('Cards',sum(len(p['items']) for p in packs),'nouns',sum(i['pos']=='noun' for p in packs for i in p['items']),'bridges',len(new)+40)
