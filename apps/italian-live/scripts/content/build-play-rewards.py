from pathlib import Path
import json
from xml.sax.saxutils import escape
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle,PageBreak,KeepTogether
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet,ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import A4
root=Path(__file__).resolve().parents[2];out=root/'public/rewards';out.mkdir(exist_ok=True)
words=json.loads((root/'scripts/content/play-words.json').read_text())
for name,file in [('DV','DejaVuSans.ttf'),('DVB','DejaVuSans-Bold.ttf')]:pdfmetrics.registerFont(TTFont(name,'/usr/share/fonts/truetype/dejavu/'+file))
pdfmetrics.registerFontFamily('DV',normal='DV',bold='DVB',italic='DV',boldItalic='DVB')
styles=getSampleStyleSheet();styles.add(ParagraphStyle(name='Body',fontName='DV',fontSize=11,leading=17,spaceAfter=10));styles.add(ParagraphStyle(name='TitleDV',fontName='DVB',fontSize=24,leading=30,spaceAfter=16));styles.add(ParagraphStyle(name='HeadDV',fontName='DVB',fontSize=15,leading=21,spaceBefore=12,spaceAfter=10));styles.add(ParagraphStyle(name='Card',fontName='DVB',fontSize=18,leading=25,alignment=1));styles.add(ParagraphStyle(name='Small',fontName='DV',fontSize=9,leading=14,spaceAfter=9))
def p(t,sty='Body'):return Paragraph(t,styles[sty])
def phrase(w):return w['article']+('' if w['article'].endswith("'") else ' ')+w['word']
def header(c,d):
 c.setFillColor(colors.HexColor('#152b22'));c.rect(0,A4[1]-48,A4[0],48,fill=1,stroke=0);c.setFillColor(colors.white);c.setFont('DVB',12);c.drawString(42,A4[1]-30,'ITALIAN LIVE / PLAY & PRACTISE');c.setFillColor(colors.HexColor('#58665d'));c.setFont('DV',8);c.drawString(42,28,'Original practice material - free for personal and classroom use.');c.drawRightString(A4[0]-42,28,str(d.page))
def title(t,sub):return[p(t,'TitleDV'),p(sub),Spacer(1,8)]
def build(name,story):SimpleDocTemplate(str(out/name),pagesize=A4,leftMargin=42,rightMargin=42,topMargin=70,bottomMargin=48,title='Italian Live - '+name,author='Italian Live').build(story,onFirstPage=header,onLaterPages=header)
story=[]
for start in range(0,36,12):
 if start:story.append(PageBreak())
 story+=title('Everyday word cards',f'Set {start//12+1} of 3. Cut out the cards. Cover the meaning, say the Italian word with its article, then check.')
 cells=[[p(escape(phrase(w)),'Card'),Spacer(1,8),p(w['en'],'Small')] for w in words[start:start+12]]
 t=Table([cells[i:i+3] for i in range(0,12,3)],colWidths=[170]*3,rowHeights=[125]*4);t.setStyle(TableStyle([('GRID',(0,0),(-1,-1),.6,colors.HexColor('#a0b0a4')),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10)]));story+=[t,Spacer(1,16),p("Italian uses masculine and feminine nouns. Before a vowel, l' can belong to either gender: l'albero (masculine), l'acqua (feminine).",'Small')]
build('word-cards.pdf',story)
story=title('Word missions','A few small activities to do alone or with a learning partner. No timer needed.')
story+=[p('1. Match the meanings','HeadDV'),p('1. il libro ____<br/>2. il cane ____<br/>3. il sole ____<br/>4. la bicicletta ____<br/>5. la porta ____<br/>6. la mela ____'),p('A. apple &nbsp; B. door &nbsp; C. bicycle<br/>D. dog &nbsp; E. sun &nbsp; F. book'),p('2. Draw and label','HeadDV'),p('Draw a garden with a tree, a flower and a bird. Label all four in Italian with their articles.'),Spacer(1,100),p('3. Find it in your room','HeadDV'),p('Look for la finestra, la lampada and il tavolo. Point to each one and say the whole phrase.')]
story+=[PageBreak()]+title('Word missions - answers','Say the correct pair and try again another day if you missed one.')+[p('1-F: il libro = book<br/>2-D: il cane = dog<br/>3-E: il sole = sun<br/>4-C: la bicicletta = bicycle<br/>5-B: la porta = door<br/>6-A: la mela = apple'),p('Drawing labels','HeadDV'),p("il giardino = garden<br/>l'albero = tree<br/>il fiore = flower<br/>l'uccello = bird"),p('Try a sentence','HeadDV'),p('Questo è un albero. - This is a tree.<br/>Questa è una mela. - This is an apple.<br/>Questo è uno zaino. - This is a backpack.'),p("Un and uno are masculine singular indefinite articles; una is feminine. The feminine form una becomes un' before a vowel, as in un'auto. These differ from the definite articles il, lo, la and l'.",'Small')]
build('word-missions.pdf',story)
selected=words[:24]
story=title('Article Detective',"Write il, lo, la or l'. These exercises use singular definite articles. Say each complete phrase.")
t=Table([[p(f'{i+1}. ____ {w["word"]}'),p(w['en'])] for i,w in enumerate(selected)],colWidths=[320,190]);t.setStyle(TableStyle([('LINEBELOW',(0,0),(-1,-1),.4,colors.HexColor('#d1d8d1')),('TOPPADDING',(0,0),(-1,-1),3),('BOTTOMPADDING',(0,0),(-1,-1),3)]));story+=[t,PageBreak()]+title('Article Detective - answers',"Il and lo are masculine; la is feminine. L' is used before a vowel for either gender. There is no space after its apostrophe.")
answers=[p(f'{i+1}. <b>{escape(phrase(w))}</b> - {w["en"]}') for i,w in enumerate(selected)];t=Table([[answers[i],answers[i+12]] for i in range(12)],colWidths=[255,255]);t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('TOPPADDING',(0,0),(-1,-1),3),('BOTTOMPADDING',(0,0),(-1,-1),3)]));story+=[t,p('One more pattern','HeadDV'),p("Lo is used with masculine nouns beginning with z and certain consonant groups, including s + consonant: lo zaino, lo studente. In the plural, the definite articles are i, gli and le; those forms are not tested in this activity.")]
build('article-workbook.pdf',story)
scenes=[('Meeting someone','A: Ciao! Come ti chiami?<br/>B: Mi chiamo Alex. E tu?<br/>A: Mi chiamo Sam. Piacere!','A: Hello! What is your name?<br/>B: My name is Alex. And yours?<br/>A: My name is Sam. Nice to meet you!'),('At the bakery','A: Buongiorno! Che cosa desidera?<br/>B: Due panini, per favore.<br/>A: Altro?<br/>B: No, grazie.','A: Hello! What would you like?<br/>B: Two bread rolls, please.<br/>A: Anything else?<br/>B: No, thank you.'),('Finding a place','A: Scusi, dov’è la scuola?<br/>B: La scuola è accanto al parco.<br/>A: Grazie mille!<br/>B: Prego!','A: Excuse me, where is the school?<br/>B: The school is next to the park.<br/>A: Thank you very much!<br/>B: You are welcome!'),('Choosing a book','A: Vuoi leggere questo libro?<br/>B: Sì, volentieri. Di che cosa parla?<br/>A: Parla di un cane.<br/>B: Sembra bello!','A: Would you like to read this book?<br/>B: Yes, please. What is it about?<br/>A: It is about a dog.<br/>B: It sounds good!')]
story=[]
for n in range(2):
 if n:story.append(PageBreak())
 story+=title('Dialogue cards',f'Set {n+1} of 2. Use pretend names, take turns as A and B, then change one detail.')
 for title_,it,en in scenes[n*2:n*2+2]:story.append(KeepTogether([p(title_,'HeadDV'),p(it),p(en,'Small'),Spacer(1,20)]))
 story+=[p('A learning partner can help when asked, encourage another try, and stop for a break whenever needed.','Small')]
build('dialogue-cards.pdf',story)
story=title('Mia e il piccolo uccello','An original short story to read together. Use the word help, then draw the scene.')+[p('Mia è in giardino. Il sole splende. Accanto all’albero c’è una piccola casetta. È una casa per gli uccelli.'),p('Mia sente un rumore. Un piccolo uccello è davanti alla porta della casetta. Guarda in alto.'),p('«Ciao, piccolo uccello», dice Mia. «È questa la tua casa?» L’uccello vola sull’albero. Poi vola verso la casetta.'),p('Mia sorride. «Adesso sei a casa!» Si siede su una sedia e legge un libro. L’uccello canta.'),p('Word help','HeadDV'),p("il giardino - garden; il sole - sun; l'albero - tree<br/>la casa - house; l'uccello - bird; la porta - door<br/>la sedia - chair; il libro - book; sorridere - to smile"),p('Draw the garden','HeadDV'),p('Draw the tree, the little bird house and Mia. Label at least three things in Italian.'),Spacer(1,90),PageBreak()]+title('Story activities','Tell the story in your own words, or point to your drawing.')+[p('1. Choose an answer','HeadDV'),p('Where is Mia? A. in giardino &nbsp; B. sul treno<br/><br/>What animal does she see? A. un gatto &nbsp; B. un uccello<br/><br/>What does she read? A. un libro &nbsp; B. un orologio'),p('2. Put these events in order','HeadDV'),p('____ Mia legge un libro.<br/><br/>____ Mia sente un rumore.<br/><br/>____ L’uccello vola verso la casetta.'),p('3. Add the definite articles','HeadDV'),p('____ giardino &nbsp; ____ sole &nbsp; ____ casa<br/><br/>____ uccello &nbsp; ____ albero &nbsp; ____ libro'),p('Answers for a learning partner','HeadDV'),p("1: A, B, A.<br/>2: 3, 1, 2.<br/>3: il giardino, il sole, la casa, l'uccello, l'albero, il libro."),p('These stories and badges are practice materials, not official language qualifications.','Small')]
build('mini-story.pdf',story)
print('Created five Italian reward PDFs')
