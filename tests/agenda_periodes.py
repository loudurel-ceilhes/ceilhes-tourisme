"""Les dates compactes, les jours d’ouverture et les dates du séjour."""
import json
import os
import re
import subprocess
import unittest
from urllib.parse import urlsplit, parse_qs
from playwright.sync_api import expect
import parcours

class AgendaPeriodes(unittest.TestCase):
    setUpClass=classmethod(parcours.Parcours.setUpClass.__func__)
    stop_server=classmethod(parcours.Parcours.stop_server.__func__)
    tearDown=parcours.Parcours.tearDown
    go=parcours.Parcours.go

    def setUp(self):
        parcours.Parcours.setUp(self)
        source=[
          {'Nom_du_POI':'Exposition fermée le week-end','Description':'Fermé mardi après midi, samedi, dimanche et les jours fériés.','URI_ID_du_POI':'https://data.datatourisme.fr/32/e1202df1-7ede-3f39-9aa4-50156f240733','Periodes_regroupees':'2026-11-02<->2027-02-28','Code_postal_et_commune':'34260#Avène'},
          {'Nom_du_POI':'Marché récurrent','Description':'Marché du pays.','URI_ID_du_POI':'https://example.org/marche','Periodes_regroupees':'2026-11-14|2026-11-15|2026-11-21|2026-11-22|2026-11-28|2026-11-29','Code_postal_et_commune':'34700#Lodève'},
          {'Nom_du_POI':'Exposition à vérifier','Description':'Une exposition en cours, heures à vérifier.','Periodes_regroupees':'2026-11-01<->2027-01-01','Code_postal_et_commune':'12360#Camarès'}]
        code='''import {readFile} from 'node:fs/promises';import {preparerEvenements,rendreCartes} from './scripts/agenda.mjs';const rules=JSON.parse(await readFile('data/agenda-ouvertures.json','utf8'));console.log(rendreCartes(preparerEvenements(JSON.parse(process.argv[1]),'2026-11-14',rules.events),true));'''
        result=subprocess.run([os.environ.get('CEILHES_NODE','node'),'--input-type=module','-e',code,json.dumps(source)],cwd=parcours.ROOT,text=True,capture_output=True,check=True)
        self.body=re.sub(r'<!-- @agenda -->.*?<!-- @/agenda -->',lambda _:'<!-- @agenda --><div class="agenda-list">'+result.stdout+'</div><!-- @/agenda -->',(parcours.ROOT/'agenda.html').read_text(),flags=re.S)
        self.page.route('**/agenda.html*',lambda route:route.fulfill(status=200,content_type='text/html',body=self.body))

    def test_weekend_exclut_fermeture_et_ne_montre_que_dates_choisies(self):
        self.go('agenda.html?periode=weekend')
        cards=self.page.locator('.ev-card:not([hidden])')
        expect(cards).to_have_count(2)
        expect(cards.locator('h3')).to_have_text(['Exposition à vérifier','Marché récurrent'])
        market=cards.filter(has_text='Marché récurrent')
        expect(market.locator('.ev-dates')).to_contain_text('14 novembre 2026')
        expect(market.locator('.ev-dates')).to_contain_text('15 novembre 2026')
        expect(market.locator('.ev-dates')).not_to_contain_text('21 novembre 2026')
        expect(cards.filter(has_text='Exposition à vérifier').locator('.ev-ouverture')).to_contain_text('ouverture pendant ces dates à vérifier')

    def test_dates_partagees_reload_stockage_et_reset(self):
        self.go('agenda.html?periode=sejour&debut=2026-11-21&fin=2026-11-22&origine=amis#agenda-list')
        expect(self.page.locator('#agenda-debut')).to_have_value('2026-11-21')
        market=self.page.locator('.ev-card').filter(has_text='Marché récurrent')
        expect(market.locator('.ev-dates')).to_contain_text('21 novembre 2026')
        expect(market.locator('.ev-dates')).not_to_contain_text('14 novembre 2026')
        self.assertEqual(self.page.evaluate('SejourDates.read()'),{'start':'2026-11-21','end':'2026-11-22'})
        self.page.reload(wait_until='load')
        expect(self.page.locator('#agenda-periode')).to_have_value('sejour')
        self.page.locator('#agenda-filtres [type=reset]').click()
        expect(self.page.locator('.ev-card:not([hidden])')).to_have_count(3)
        self.assertEqual(parse_qs(urlsplit(self.page.url).query),{'origine':['amis']})
        self.assertEqual(self.page.evaluate('SejourDates.read()'),{'start':'2026-11-21','end':'2026-11-22'})

    def test_effacement_commun_nettoie_filtre_et_ne_recree_pas_les_dates(self):
        self.go('agenda.html?periode=sejour&debut=2026-11-21&fin=2026-11-22&origine=amis')
        self.page.evaluate("localStorage.removeItem('ceilhes:dates-sejour:v1');dispatchEvent(new StorageEvent('storage',{key:'ceilhes:dates-sejour:v1',newValue:null}))")
        expect(self.page.locator('#agenda-periode')).to_have_value('tous')
        expect(self.page.locator('#agenda-debut')).to_have_value('')
        self.assertNotIn('debut=',self.page.url)
        self.page.locator('#agenda-commune').select_option('Avène')
        self.assertIsNone(self.page.evaluate('SejourDates.read()'))
        self.assertIsNone(self.page.evaluate("localStorage.getItem('ceilhes:dates-sejour:v1')"))

    def test_liste_initiale_limitee_mais_toutes_les_fiches_restent_filtrables(self):
        rows=''.join('<article class="ev-card" data-commune="Village '+str(i)+'" data-activite="Concert" data-periodes="[{&quot;debut&quot;:&quot;2026-12-18&quot;,&quot;fin&quot;:&quot;2026-12-18&quot;}]"><div class="ev-body"><h3>Concert '+str(i)+'</h3></div></article>' for i in range(15))
        self.body=self.body.replace('<!-- @/agenda -->', '<div class="agenda-list">'+rows+'</div><!-- @/agenda -->')
        self.go('agenda.html')
        expect(self.page.locator('.ev-card:not([hidden])')).to_have_count(12)
        expect(self.page.locator('#agenda-plus')).to_contain_text('6 autres')
        self.page.locator('#agenda-commune').select_option('Village 14')
        expect(self.page.locator('.ev-card:not([hidden]) h3')).to_have_text('Concert 14')
        self.page.locator('#agenda-filtres [type=reset]').click()
        self.page.locator('#agenda-plus').click()
        expect(self.page.locator('.ev-card:not([hidden])')).to_have_count(18)

    def test_dates_trop_longues_non_enregistrees(self):
        self.go('agenda.html')
        self.page.locator('#agenda-periode').select_option('sejour')
        self.page.locator('#agenda-debut').fill('2026-11-15')
        self.page.locator('#agenda-fin').fill('2027-01-15')
        self.page.locator('#agenda-fin').press('Tab')
        expect(self.page.locator('#agenda-dates-statut')).to_contain_text('31 jours maximum')
        self.assertIsNone(self.page.evaluate('SejourDates.read()'))
        expect(self.page.locator('.ev-card:not([hidden])')).to_have_count(3)

    def test_repli_natif_utilisable_sans_javascript(self):
        context=self.browser.new_context(java_script_enabled=False,viewport={'width':390,'height':844})
        try:
            context.route('**/*',lambda route:route.continue_() if urlsplit(route.request.url).hostname=='127.0.0.1' else route.abort())
            context.route('**/agenda.html*',lambda route:route.fulfill(status=200,content_type='text/html',body=self.body))
            page=context.new_page();page.goto(self.base+'agenda.html')
            market=page.locator('.ev-card').filter(has_text='Marché récurrent')
            expect(market.locator('.ev-periode:visible')).to_have_count(3)
            market.locator('.ev-autres-dates summary').click()
            expect(market.locator('.ev-periode:visible')).to_have_count(6)
            self.assertTrue(page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        finally:context.close()

if __name__=='__main__':unittest.main(verbosity=2)
