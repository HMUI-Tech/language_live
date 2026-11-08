import json,re,shutil
from pathlib import Path
r=Path(__file__).resolve().parents[2];p=r/'public/learn.html';s=p.read_text()
rules=[
('masculine','il → i','Most consonants',[['il libro → i libri','book → books'],['il cane → i cani','dog → dogs']], 'Use il for most masculine singular nouns beginning with a consonant; its plural is i.'),
('masculine','lo → gli','Special initial sounds',[['lo studente → gli studenti','student → students'],['lo zaino → gli zaini','backpack → backpacks']], 'Use lo before s + consonant, z, gn, ps and certain other initial sounds. The plural is gli. Learn loanwords with their article.'),
('masculine',"l’ → gli",'Before a vowel',[["l'amico → gli amici",'male friend → male friends'],["l'uomo → gli uomini",'man → men']], 'Before a vowel, masculine lo normally becomes l’. Its plural is gli, without an apostrophe.'),
('feminine','la → le','Before a consonant',[['la casa → le case','house → houses'],['la notte → le notti','night → nights']], 'Use la for feminine singular nouns before a consonant. The plural is le.'),
('feminine',"l’ → le",'Before a vowel',[["l'amica → le amiche",'female friend → female friends'],["l'isola → le isole",'island → islands']], 'Before a vowel, feminine la normally becomes l’. Its plural is le. L’ alone does not tell you the gender.'),
('masculine','-o','Often masculine',[['il libro','book'],['il tavolo','table']], 'A useful clue, not a guarantee: la mano (hand) is feminine. Learn the article with each noun.'),
('feminine','-a','Often feminine',[['la casa','house'],['la porta','door']], 'Common exceptions include il problema, il programma and il poeta.'),
('feminine','-zione / -sione','Usually feminine',[['la stazione','station'],['la decisione','decision']], 'A reliable learning clue for these noun-forming suffixes. Do not apply it to an unrelated word just because of its final letters.'),
('feminine','-tà / -tù','Usually feminine',[['la città','city'],['la libertà','freedom'],['la gioventù','youth']], 'These stressed endings often mark feminine nouns. Such nouns usually keep the same spelling in the plural: le città.'),
('feminine','-trice','Female person or agent',[['la scrittrice','female writer'],["l'attrice",'actress']], 'Many female agent nouns end in -trice. The plural ends in -trici.'),
('masculine','-ore','Often masculine',[['il colore','colour'],['il motore','engine']], 'There are exceptions: la folgore (lightning). Memorise each word with its article.'),
('masculine','-ma','Some Greek-origin nouns',[['il problema','problem'],['il sistema','system'],['il tema','topic']], 'Many Greek-origin words in -ma are masculine, but not every -ma word: la crema and la forma are feminine.'),
('both','-e','Either gender',[['il mare','sea'],['la notte','night']], 'The ending -e does not reliably predict gender. Many nouns in -e have a plural in -i.'),
('both','-ista','Common gender',[['il giornalista / la giornalista','journalist'],["il turista / la turista",'tourist']], 'The article and agreement indicate the person’s gender. Masculine plurals end in -isti; feminine plurals in -iste.'),
('masculine','un / uno','Indefinite articles',[['un libro','a book'],['uno studente','a student'],['un amico','a male friend']], 'Un is used before most consonants and vowels; uno is used where the definite form is lo. Masculine un has no apostrophe.'),
('feminine',"una / un’",'Indefinite articles',[['una casa','a house'],["un'amica",'a female friend']], 'Use una before consonants and un’ before vowels. Here the apostrophe matters: un amico, un’amica.'),
('both','di + article','Contracted prepositions',[['del libro / della casa','of the book / of the house'],["dell'amico / degli amici",'of the friend / of the friends']], 'Di combines with definite articles: del, dello, della, dell’, dei, degli, delle. A, da, in and su also combine with articles.'),
('both','Noun + adjective','Agreement',[['il libro nuovo / i libri nuovi','new book / new books'],['la casa nuova / le case nuove','new house / new houses']], 'Articles and adjectives agree with a noun’s gender and number. The spelling clues are learning aids, not substitutes for a dictionary.')]
guide={'rules':[dict(article=a,ending=e,strength=st,ex=ex,note=n) for a,e,st,ex,n in rules],'pairs':[],'extraPairs':[],'falseFriends':[
['attualmente','currently','actually = in realtà / effettivamente'],['eventualmente','possibly / if necessary','eventually = alla fine'],['la libreria','bookshop / bookcase','library = la biblioteca'],['la camera','room','camera (device) = la macchina fotografica'],['i parenti','relatives','parents = i genitori'],['la fattoria','farm','factory = la fabbrica'],['il magazzino','warehouse / store room','magazine = la rivista'],['il pavimento','floor','pavement = il marciapiede (British English)'],['morbido','soft','morbid = morboso'],['sensibile','sensitive','sensible = sensato'],['educato','polite / well-mannered','educated = istruito'],['pretendere','demand / expect','pretend = fingere'],['assistere','attend / help (depending on context)','assist can mean aiutare; assistere a means attend'],['la confidenza','familiarity / a confidence shared','confidence (self-belief) = la fiducia in sé'],['la delusione','disappointment','delusion = illusione / delirio (context matters)'],['il preservativo','condom','preservative = il conservante']]}
wordlines='''
la musica|music|Ascolto la musica.|I listen to music.
la persona|person|È una persona gentile.|They are a kind person.
la famiglia|family|La mia famiglia è qui.|My family is here.
la nazione|nation|Ogni nazione ha una storia.|Every nation has a history.
la stazione|station|La stazione è vicina.|The station is nearby.
la situazione|situation|La situazione è chiara.|The situation is clear.
la tradizione|tradition|È una tradizione locale.|It is a local tradition.
la comunicazione|communication|La comunicazione è importante.|Communication is important.
la decisione|decision|È una decisione difficile.|It is a difficult decision.
la televisione|television|Guardo la televisione.|I watch television.
la qualità|quality|La qualità è buona.|The quality is good.
la possibilità|possibility|Abbiamo una possibilità.|We have a possibility.
la realtà|reality|Questa è la realtà.|This is reality.
la creatività|creativity|La creatività aiuta.|Creativity helps.
la temperatura|temperature|La temperatura sale.|The temperature is rising.
la cultura|culture|Mi interessa la cultura.|I am interested in culture.
la natura|nature|Amo la natura.|I love nature.
la biologia|biology|Studio biologia.|I study biology.
la tecnologia|technology|La tecnologia cambia.|Technology changes.
la democrazia|democracy|La democrazia è importante.|Democracy is important.
il turismo|tourism|Il turismo crea lavoro.|Tourism creates jobs.
il realismo|realism|Serve realismo.|Realism is needed.
il problema|problem|Abbiamo un problema.|We have a problem.
il sistema|system|Il sistema funziona.|The system works.
il programma|program|Il programma inizia ora.|The program starts now.
il documento|document|Leggo il documento.|I am reading the document.
il momento|moment|Aspetta un momento.|Wait a moment.
il museo|museum|Il museo è aperto.|The museum is open.
il telefono|telephone|Il telefono suona.|The telephone is ringing.
il computer|computer|Uso il computer.|I use the computer.
il ristorante|restaurant|Il ristorante è vicino.|The restaurant is nearby.
il giardino|garden|Il giardino è verde.|The garden is green.
importante|important|Questo è importante.|This is important.
possibile|possible|È possibile.|It is possible.
differente|different|È un metodo differente.|It is a different method.
naturale|natural|Il colore è naturale.|The colour is natural.
attivo|active|Sono molto attivo.|I am very active.
creativo|creative|È un lavoro creativo.|It is creative work.
logico|logical|È un risultato logico.|It is a logical result.
pratico|practical|È un consiglio pratico.|It is practical advice.
'''
for line in wordlines.strip().splitlines():
 it,en,ex,tr=line.split('|');guide['pairs'].append([it,en,'Everyday',ex,tr,'A1'])
# Remove overlapping dictionary headwords so the count is distinct.
data=json.loads((r/'public/data/word-bridges.json').read_text());head=lambda x:re.sub(r"^(?:il |lo |la |l'|i |gli |le )",'',x)
seen={head(row[0]) for row in guide['pairs']};data=[x for x in data if head(x[0]) not in seen]
(r/'public/data/word-bridges.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
total=len(data)+len(guide['pairs']);print('Word bridge total',total,'dictionary',len(data))
start=s.index('<script>\n/* Original learning notes.');end=s.index('</script>',start)
s=s[:start]+'<script>\nwindow.DLGuides = '+json.dumps(guide,ensure_ascii=False,separators=(',',':'))+';\n'+s[end:]
# Replace embedded German content with independent Italian content.
s=re.sub(r'(<script[^>]*id="dl-content"[^>]*>)[\s\S]*?(</script>)',lambda m:m[1]+(r/'public/content.json').read_text().replace('</','<\\/')+m[2],s,count=1)
s=s.replace('return item.pos === "noun" && item.art ? `${item.art} ${item.de}` : item.de;','return item.pos === "noun" && item.art ? item.art + (item.art.endsWith("\'") ? "" : " ") + item.de : item.de;')
s=s.replace('}, item.art), " ", item.de)', '}, item.art), item.art.endsWith("\'") ? "" : " ", item.de)')
s=s.replace('.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")','')
s=s.replace('"Noun endings can help you remember grammatical gender. Learn the article together with every new noun."','"Learn masculine and feminine noun patterns, definite articles and plurals. Memorise the article together with each noun."')
s=s.replace('r.article === selected','(r.article === selected || r.article === "both")')
s=s.replace('guideExample(r.article, word, meaning)','guideExample("", word, meaning)')
s=s.replace('[["all", "All"], ["der", "der"], ["die", "die"], ["das", "das"]]','[["all", "All"], ["masculine", "Masculine"], ["feminine", "Feminine"]]')
s=s.replace('Wortwissen · Word patterns','Parole · Word patterns').replace('Der, die oder das?','Il, lo, la o l’ ?').replace('-ung ≠ -ling ≠ -ing','Gender + number + first sound')
s=s.replace('die Wohnung · der Lehrling · das Training. -ung is feminine when it is the noun-forming suffix. -ling is masculine. Many English -ing loanwords are neuter.','il libro → i libri · lo studente → gli studenti · la casa → le case · l’amico → gli amici · l’amica → le amiche.')
s=s.replace('These are dictionary forms: nominative singular. Articles change with case, and all nouns use die in the nominative plural. Compounds take the gender of their final noun: die Hausaufgabe, das Krankenhaus.','Italian has masculine and feminine nouns, without a neuter article. The article depends on gender, singular/plural and the next sound. L’ can be masculine or feminine; learn the noun’s gender separately.')
# Source link is Italian-specific and original explanations stay original.
a=s.index('  function guideSources(english) {');b=s.index('  function guideExample',a)
s=s[:a]+'''  function guideSources(english) {
    return h("p",{class:"small muted"}, "Sources and further reading: ", h("a",{href:"/credits.html"},"Dictionary credits and licences"), " · ",h("a",{href:"https://www.treccani.it/enciclopedia/articoli-determinativi_(La-grammatica-italiana)/",target:"_blank",rel:"noopener noreferrer"},"Treccani · Italian articles"));
  }
'''+s[b:]
a=s.index('    const patterns = [',s.index('function viewEnglish'));b=s.index('    const level =',a)
s=s[:a]+'''    const patterns = [
      ['tion','-tion → -zione','nation → nazione; communication → comunicazione. Many such nouns are feminine.'],
      ['sion','-sion → -sione','decision → decisione; television → televisione. Meanings may overlap only in some contexts.'],
      ['ity','-ity → -ità','quality → qualità; possibility → possibilità. These nouns normally keep the same form in the plural.'],
      ['ic','-ic / -ical → -ico','logical → logico; practical → pratico. Adjective endings change for gender and number.'],
      ['ive','-ive → -ivo','active → attivo; creative → creativo. Learn the feminine and plural forms too.'],
      ['ism','-ism → -ismo','tourism → turismo; realism → realismo. These nouns are generally masculine.'],
      ['y','-y → -ia','biology → biologia; technology → tecnologia. A family resemblance, not a universal translation rule.']
    ];
    const matchesPattern = (row,id) => ({tion:/zione$/,sion:/sione$/,ity:/ità$/,ic:/ico$/,ive:/ivo$/,ism:/ismo$/,y:/ia$/})[id].test(row[0]);
'''+s[b:]
s=s.replace(' || rows.length !== 3820',' || rows.length !== '+str(len(data)))
s=s.replace('Wortbrücken · Word bridges','Ponti di parole · Word bridges')
s=s.replace('English → Inglese (the language), englisch (the adjective).','English → inglese. Italian → italiano. Language names and nationality adjectives are normally lowercase in Italian.')
s=s.replace('Language names can appear without an article: Ich spreche Inglese.','Language names can appear without an article: Parlo inglese.')
s=s.replace('Search English or Italian: house, Haus…','Search English or Italian: music, musica…')
s=s.replace('4,000 word pairs available · 180 with original example sentences, 3,820 dictionary-derived spelling matches.',f'{total:,} word pairs available · 40 with original example sentences; {len(data):,} dictionary-derived spelling matches.')
s=s.replace('The 180 example pairs are still available.','The 40 example pairs are still available.').replace('the 180 editorial examples','the 40 editorial examples')
s=s.replace('Dictionary source: Ding 1.9 by Frank Richter, GPL-2.0-or-later.','Dictionary source: FreeDict/WikDict 2025.11.23, from Wiktionary via DBnary, CC BY-SA 3.0.')
s=s.replace('3,820 dictionary-derived','dictionary-derived')
# Remove remaining German example placeholders in learner-only copy.
s=s.replace('Ich spreche','Parlo').replace('der, die, das','il, lo, la').replace('der / die / das','il / lo / la').replace('englisch','inglese')
s=s.replace('>D</div>','>I</div>')
p.write_text(s)
# Keep only the Italian source, not the unrelated German dictionary downloads.
shutil.copy('/tmp/ita-eng.tar.xz',r/'public/data/italian-dictionary-source.tar.xz')
