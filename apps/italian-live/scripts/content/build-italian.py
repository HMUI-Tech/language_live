"""Rebuild Italian vocabulary and scenarios. Requires wordfreq==3.1.1 (build only).
Input: FreeDict/WikDict ita-eng 2025.11.23 TEI, CC BY-SA 3.0.
"""
import re,json,sys,unicodedata,shutil
from pathlib import Path
from lxml import etree
from difflib import SequenceMatcher
from wordfreq import zipf_frequency
root=Path(__file__).resolve().parents[2]
ns={'t':'http://www.tei-c.org/ns/1.0'}
def article(word,gender):
 vowel=word[0].lower() in 'aeiouàèéìòù'
 if gender=='fem':return "l'" if vowel else 'la'
 if gender=='masc':return "l'" if vowel else ('lo' if re.match(r'^(z|gn|ps|pn|x|y|s[^aeiou])',word,re.I) else 'il')
 return ''
def normalize(x):return ''.join(c for c in unicodedata.normalize('NFKD',x.lower()) if not unicodedata.combining(c))
blocked=('penis','vagina','fuck','cunt','nigger','nazi','hitler','porn','masturb','suicid','sessual','sexual','prostitut','negro','fascis','holocaust','terroris','orgasm','erotic','erotico','fetish','fetisc','razzis','racis')
entries={}
for _,entry in etree.iterparse(sys.argv[1],tag='{'+ns['t']+'}entry',load_dtd=False,no_network=True):
 w=entry.findtext('t:form/t:orth',namespaces=ns) or ''
 pos=entry.findtext('t:gramGrp/t:pos',namespaces=ns) or ''
 gen=entry.findtext('t:gramGrp/t:gen',namespaces=ns) or ''
 translations=[q.text or '' for q in entry.findall('t:sense/t:cit[@type="trans"]/t:quote',ns)]
 translations=[e for e in translations if re.fullmatch(r'[a-zA-Z][a-zA-Z -]{1,60}',e) and e[0].islower()]
 if not re.fullmatch(r'[a-zàèéìòù][a-zàèéìòù]{2,24}',w) or not translations or pos not in ['n','v','adj','adv','prep','conj','pron','num','interj']:entry.clear();continue
 if pos=='n' and gen not in ['fem','masc']:entry.clear();continue
 if any(t in (w+' '+' '.join(translations)).lower() for t in blocked):entry.clear();continue
 freq=zipf_frequency(w,'it')
 if freq<1.6:entry.clear();continue
 row={'de':w,'pos':{'n':'noun','v':'verb'}.get(pos,pos),'en':translations[0]}
 if pos=='n':row['art']=article(w,gen)
 # Keep an attested closest translation for word bridges rather than inventing one.
 matches=[(SequenceMatcher(None,normalize(w),normalize(e)).ratio(),e) for e in translations if re.fullmatch('[a-zA-Z]{3,24}',e)]
 match=max(matches,default=(0,''))
 if w not in entries or freq>entries[w][0]:entries[w]=(freq,row,match)
 entry.clear()
ranked=sorted(entries.values(),key=lambda r:(-r[0],r[1]['de']))
print('Dictionary base forms:',len(ranked))
packs=[];editorial=[]
for block in (root/'scripts/content/italian-scenarios.txt').read_text().strip().split('\n\n'):
 lines=block.splitlines();level,week,slug,title,en=lines[0].split('|');steps=[];items=[]
 for j,line in enumerate(lines[1:]):
  npc,npc_en,answer,answer_en,wrong,why=line.split('|')
  steps.append({'npc':npc,'npc_en':npc_en,'options':[{'de':answer,'ok':True},{'de':wrong,'ok':False,'why':why}]})
  for k,(text,meaning) in enumerate([(npc,npc_en),(answer,answer_en)]):
   items.append({'id':f'{slug}.{j}-{k}','de':text,'en':meaning,'pos':'phrase','ex':text,'ex_en':meaning})
  editorial.append([answer,answer_en,'Everyday',answer,answer_en,level])
 packs.append({'id':slug,'kind':'situation','level':level,'week':int(week),'title':title,'title_en':en,'items':items,'dialogue':{'setting':f'Practise {en.lower()} in Italy. Use fictional details.','steps':steps}})
# 4,000 distinct dictionary headwords plus 208 original dialogue phrase cards.
for i in range(0,4000,40):
 idx=i//40;level='A1' if i<800 else 'A2' if i<1700 else 'B1' if i<2900 else 'B2';week=min(26,1+int(idx/100*26));items=[]
 for n,(_,row,_) in enumerate(ranked[i:i+40]):items.append(dict(row,id=f'core-{idx+1}.{n+1}'))
 packs.append({'id':f'core-{idx+1:03}','kind':'vocabulary','level':level,'week':week,'title':f'Vocabolario {idx+1}','title_en':f'Vocabulary {idx+1} · frequency band','items':items})
content={'version':'1.0.0','language':'it','packs':sorted(packs,key=lambda p:(p['week'],p['kind']!='situation',p['id']))}
(root/'public/content.json').write_text(json.dumps(content,ensure_ascii=False,separators=(',',':')))
# Bridge thresholds are similarity clues, not an etymological classification.
bridges=[]
for freq,row,(score,en) in ranked:
 w=row['de'];a,b=normalize(w),normalize(en)
 if score>=.68 and a[0]==b[0] and len(w)>=4 and abs(len(a)-len(b))<=5:
  art=row.get('art','');full=art+w if art.endswith("'") else (art+' '+w).strip()
  bridges.append([full,en,'Dictionary','','','ungraded'])
print('Spelling bridge candidates:',len(bridges))
(root/'public/data/word-bridges.json').write_text(json.dumps(bridges[:4000],ensure_ascii=False,separators=(',',':')))
(root/'scripts/content/italian-editorial.json').write_text(json.dumps(editorial,ensure_ascii=False))
print('Packs',len(packs),'cards',sum(len(p['items']) for p in packs),'dialogue steps',sum(len(p.get('dialogue',{}).get('steps',[])) for p in packs),'bridges',min(4000,len(bridges)))
print('Bridge sample',bridges[::250][:16])
