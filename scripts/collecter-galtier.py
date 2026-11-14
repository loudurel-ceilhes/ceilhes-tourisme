"""Collecter l'annuaire public sans données de contact, puis relire les changements.

Ce script écrit un instantané de travail, jamais le registre éditorial en place.
Exemple : python3 scripts/collecter-galtier.py --sortie /tmp/galtier-public.json
"""
import urllib.request,urllib.parse,json,concurrent.futures,pathlib
import argparse,datetime
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--sortie',required=True,type=pathlib.Path)
args=parser.parse_args()
if args.sortie.resolve() == (pathlib.Path(__file__).resolve().parents[1]/'data/reseau-producteurs.json').resolve():
 parser.error('Utiliser un instantané de travail, puis relire et intégrer les changements sans écraser les statuts éditoriaux.')

cats=['APERITIFS','BIERE','BISCUIT','CHARCUTERIE','CONSERVE','CONSERVE FRUIT','DIVERS','FROMAGE','FRUITS ET LEGUMES','GLACIER','MIELLERIE','MINOTERIE','PLATS PRÉPARÉS','PRODUITS COSMETIQUES','PRODUITS FERMIERS','PRODUITS LAITIERS','VIANDE','VIN']
base='https://www.galtier-edi.com/Fichiers/api_producteurs_list.php?'
entries={};totals={};pages={}
def fetch(arg):
 cat,page=arg
 url=base+urllib.parse.urlencode({'page':page,'produit':cat,'search':''})
 d=json.load(urllib.request.urlopen(url,timeout=40))
 if not d.get('success'):raise ValueError('API failure')
 return cat,d
expected=json.load(urllib.request.urlopen(base+urllib.parse.urlencode({'page':1,'produit':'tout','search':''}),timeout=40))['total_items']
for round in range(10):
 jobs=[]
 for cat in cats:
  found=sum(cat in p['categories'] for p in entries.values())
  if cat not in totals or found<totals[cat]:jobs +=[(cat,n) for n in range(1,pages.get(cat,1)+1)]
 if not jobs:break
 with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
  for cat,d in pool.map(fetch,jobs):
   totals[cat]=int(d['total_items']);pages[cat]=int(d['total_pages'])
   for p in d['producteurs']:
    key=str(p['id'])
    value={k:str(p.get(k) or '').strip() for k in ['id','nom','ville','cp','adresse_internet']}
    value['categories']=sorted(set(entries.get(key,{}).get('categories',[])+[cat]))
    entries[key]=value
 print('round',round+1,'unique',len(entries),'missing',{c:totals[c]-sum(c in p['categories'] for p in entries.values()) for c in cats if totals[c]>sum(c in p['categories'] for p in entries.values())},flush=True)
else:raise SystemExit('Incomplete catalogue; do not publish')
if len(entries)!=int(expected):raise SystemExit('Total incomplet ou catégorie modifiée : revue nécessaire, aucune sortie écrite')
out={'maj':datetime.date.today().isoformat(),'total':len(entries),'totauxCategories':totals,'producteurs':list(entries.values())}
args.sortie.write_text(json.dumps(out,ensure_ascii=False,indent=2))
print('complete',len(entries),flush=True)
