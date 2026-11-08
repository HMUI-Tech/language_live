from pathlib import Path
import json
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle,PageBreak,KeepTogether
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet,ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import A4
root=Path(__file__).resolve().parents[2];out=root/'public/rewards';out.mkdir(exist_ok=True)
words=json.loads((root/'scripts/content/play-words.json').read_text())
pdfmetrics.registerFont(TTFont('DV','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DV-Bold','/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
pdfmetrics.registerFontFamily('DV',normal='DV',bold='DV-Bold',italic='DV',boldItalic='DV-Bold')
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='BodyDV',fontName='DV',fontSize=11,leading=17,spaceAfter=9,textColor=colors.HexColor('#15231b')))
styles.add(ParagraphStyle(name='H1DV',fontName='DV-Bold',fontSize=25,leading=31,spaceAfter=14,textColor=colors.HexColor('#15231b')))
styles.add(ParagraphStyle(name='H2DV',fontName='DV-Bold',fontSize=15,leading=21,spaceBefore=8,spaceAfter=9))
styles.add(ParagraphStyle(name='CardDV',fontName='DV-Bold',fontSize=18,leading=24,alignment=TA_CENTER,spaceAfter=6))
styles.add(ParagraphStyle(name='SmallDV',fontName='DV',fontSize=9,leading=13,spaceAfter=6))
def p(t,style='BodyDV'):return Paragraph(t,styles[style])
def header(c,d):
 w,h=A4;c.setFillColor(colors.HexColor('#15231b'));c.rect(0,h-48,w,48,fill=1,stroke=0);c.setFont('DV-Bold',12);c.setFillColor(colors.white);c.drawString(42,h-30,'DEUTSCH LIVE  /  PLAY & PRACTISE');c.setFillColor(colors.HexColor('#617166'));c.setFont('DV',8);c.drawString(42,28,'Original practice material - free for personal and classroom use.');c.drawRightString(w-42,28,str(d.page))
def build(name,story):
 doc=SimpleDocTemplate(str(out/name),pagesize=A4,rightMargin=42,leftMargin=42,topMargin=70,bottomMargin=48,title='Deutsch Live - '+name.replace('-',' ').replace('.pdf',''),author='Deutsch Live')
 doc.build(story,onFirstPage=header,onLaterPages=header)
def title(t,sub):return[p(t,'H1DV'),p(sub),Spacer(1,10)]
# 36 cards: three pages, twelve cut-out cards on each.
story=[]
for start in range(0,36,12):
 if start:story.append(PageBreak())
 story+=title('Everyday word cards',f'Set {start//12+1} of 3. Cut along the lines. Cover the English meaning, say the German word with its article, then check.')
 cells=[]
 for w in words[start:start+12]:cells.append([p(w['article']+' '+w['word'],'CardDV'),p(w['en'],'BodyDV')])
 rows=[cells[i:i+3] for i in range(0,12,3)];tab=Table(rows,colWidths=[170]*3,rowHeights=[125]*4);tab.setStyle(TableStyle([('GRID',(0,0),(-1,-1),.6,colors.HexColor('#a1afa3')),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10)]));story.append(tab)
 story.append(Spacer(1,14));story.append(p('Try together: one person reads a word; the other points to, draws or describes it. No timer needed.','SmallDV'))
build('word-cards.pdf',story)
# Mission pack.
story=title('Word missions','Choose a few activities. You do not have to finish everything in one sitting.')
story += [p('1. Find the meaning','H2DV'),p('Write the matching letter beside each word.'),p('1. das Buch ____<br/>2. der Hund ____<br/>3. die Sonne ____<br/>4. das Fahrrad ____<br/>5. die Tür ____<br/>6. der Apfel ____'),p('A. apple &nbsp; B. door &nbsp; C. bicycle<br/>D. dog &nbsp; E. sun &nbsp; F. book'),p('2. Draw and say','H2DV'),p('Draw a garden with a tree, a flower and a bird. Label each one in German, including its article.'),Spacer(1,120),p('3. Spot it together','H2DV'),p('Look around your room with a friend or grown-up. Can you find das Fenster, die Lampe and der Tisch? Point and say each word.')]
story += [PageBreak()]+title('Word missions - answers','Check together. If you missed one, say the correct pair and try it again later.')
story += [p('Matching','H2DV'),p('1-F: das Buch = book<br/>2-D: der Hund = dog<br/>3-E: die Sonne = sun<br/>4-C: das Fahrrad = bicycle<br/>5-B: die Tür = door<br/>6-A: der Apfel = apple'),p('Drawing labels','H2DV'),p('der Garten = garden<br/>der Baum = tree<br/>die Blume = flower<br/>der Vogel = bird'),p('A useful sentence','H2DV'),p('Das ist ein Baum. - This is a tree.<br/>Das ist eine Blume. - This is a flower.<br/>Das ist ein Buch. - This is a book.'),p('Notice: ein is used here with masculine and neuter nouns; eine is used with feminine nouns. These sentences use the nominative case.'),p('Your next mission','H2DV'),p('Choose three other cards. Draw them, label them and teach the words to someone else.')]
build('word-missions.pdf',story)
selected=words[:24]
story=title('Article Detective workbook','Write der, die or das. Say the whole phrase aloud. Learn the article together with each noun.')
data=[[p(f'{i+1}. ____ {w["word"]}'),p(w['en'])] for i,w in enumerate(selected)]
t=Table(data,colWidths=[320,190]);t.setStyle(TableStyle([('LINEBELOW',(0,0),(-1,-1),.4,colors.HexColor('#d1d8d1')),('TOPPADDING',(0,0),(-1,-1),3),('BOTTOMPADDING',(0,0),(-1,-1),3)]));story.append(t)
story += [PageBreak()]+title('Article Detective - answer key','These are nominative singular forms. Articles change in other cases, and nominative plurals use die.')
answers=[p(f'{i+1}. <b>{w["article"]} {w["word"]}</b> - {w["en"]}') for i,w in enumerate(selected)]
answer_table=Table([[answers[i],answers[i+12]] for i in range(12)],colWidths=[255,255]);answer_table.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('TOPPADDING',(0,0),(-1,-1),3),('BOTTOMPADDING',(0,0),(-1,-1),3)]));story.append(answer_table)
story+=[p('Try a new way','H2DV'),p('Sort your word cards into three groups: der, die and das. Then mix them up and try again another day.')]
build('article-workbook.pdf',story)
# Original dialogue cards. No real personal details required.
scenes=[('Meeting someone','A: Hallo! Wie heißt du?<br/>B: Ich heiße Alex. Und du?<br/>A: Ich heiße Sam. Freut mich!','A: Hello! What is your name?<br/>B: My name is Alex. And yours?<br/>A: My name is Sam. Nice to meet you!'),('At the bakery','A: Guten Tag! Was möchten Sie?<br/>B: Zwei Brötchen, bitte.<br/>A: Sonst noch etwas?<br/>B: Nein, danke.','A: Hello! What would you like?<br/>B: Two bread rolls, please.<br/>A: Anything else?<br/>B: No, thank you.'),('Finding a place','A: Entschuldigung, wo ist die Schule?<br/>B: Die Schule ist neben dem Park.<br/>A: Vielen Dank!<br/>B: Gern!','A: Excuse me, where is the school?<br/>B: The school is next to the park.<br/>A: Thank you very much!<br/>B: You are welcome!'),('Choosing a book','A: Möchtest du dieses Buch lesen?<br/>B: Ja, gern. Worum geht es?<br/>A: Es geht um einen Hund.<br/>B: Das klingt gut!','A: Would you like to read this book?<br/>B: Yes, please. What is it about?<br/>A: It is about a dog.<br/>B: That sounds good!')]
story=[]
for page in range(2):
 if page:story.append(PageBreak())
 story+=title('Dialogue cards',f'Set {page+1} of 2. Take turns as A and B. Use pretend names. Read slowly, swap roles, then change one detail.')
 for heading,de,en in scenes[page*2:page*2+2]:story.append(KeepTogether([p(heading,'H2DV'),p(de),p(en,'SmallDV'),Spacer(1,22)]))
 story.append(p('For a grown-up or learning partner: help only when asked. Praise the effort, allow retries and stop when the learner needs a break.','SmallDV'))
build('dialogue-cards.pdf',story)
story=title('Mia und der kleine Vogel','A short original story. Read together, use the word help and draw what happens.')
story += [p('Mia ist im Garten. Die Sonne scheint. Neben dem Baum steht ein kleines Haus. Es ist ein Haus für Vögel.'),p('Mia hört etwas. Ein kleiner Vogel sitzt vor der Tür. Er schaut nach oben.'),p('„Hallo, kleiner Vogel“, sagt Mia. „Ist das dein Haus?“ Der Vogel fliegt auf den Baum. Dann fliegt er zu dem kleinen Haus.'),p('Mia lächelt. „Jetzt bist du zu Hause.“ Sie setzt sich auf einen Stuhl und liest ein Buch. Der Vogel singt.'),p('Word help','H2DV'),p('der Garten - garden; die Sonne - sun; der Baum - tree<br/>das Haus - house; der Vogel - bird; die Tür - door<br/>der Stuhl - chair; das Buch - book; lächeln - to smile'),p('Draw the garden','H2DV'),p('Include the tree, the little bird house and Mia. Label at least three things in German.'),Spacer(1,140)]
story += [PageBreak()]+title('Story activities','Tell the story again in your own words or point to your drawing.')
story += [p('1. Choose the answer','H2DV'),p('Where is Mia? &nbsp; A. im Garten &nbsp; B. im Zug<br/><br/>What animal does she see? &nbsp; A. eine Katze &nbsp; B. einen Vogel<br/><br/>What does Mia read? &nbsp; A. ein Buch &nbsp; B. eine Uhr'),p('2. Put these events in order','H2DV'),p('____ Mia liest ein Buch.<br/><br/>____ Mia hört etwas.<br/><br/>____ Der Vogel fliegt zu dem kleinen Haus.'),p('3. Find the articles','H2DV'),p('____ Garten &nbsp;&nbsp; ____ Sonne &nbsp;&nbsp; ____ Haus<br/><br/>____ Vogel &nbsp;&nbsp; ____ Baum &nbsp;&nbsp; ____ Buch'),p('Answers for your learning partner','H2DV'),p('1: A, B, A.<br/>2: 3, 1, 2 (Mia hears something; the bird flies to the house; Mia reads).<br/>3: der Garten, die Sonne, das Haus, der Vogel, der Baum, das Buch.'),p('This story and these badges are practice materials, not a test or an official language qualification.','SmallDV')]
build('mini-story.pdf',story)
print('Created five original reward PDFs.')
