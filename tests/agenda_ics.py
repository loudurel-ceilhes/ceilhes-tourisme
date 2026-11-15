"""Export local du rendez-vous choisi : fichier réel, clavier et filtres."""
import json
import os
import re
import subprocess
import unittest
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
from playwright.sync_api import expect
import parcours


class AgendaCalendrier(unittest.TestCase):
    setUpClass = classmethod(parcours.Parcours.setUpClass.__func__)
    stop_server = classmethod(parcours.Parcours.stop_server.__func__)
    tearDown = parcours.Parcours.tearDown
    go = parcours.Parcours.go

    def setUp(self):
        parcours.Parcours.setUp(self)
        source = [
            {'Nom_du_POI':'Marché à Avène', 'Description':'Rencontre des producteurs. À partir de 15h dans le descriptif.', 'Periodes_regroupees':'2026-11-17|2026-11-24', 'Adresse_postale':'Place de la mairie', 'Code_postal_et_commune':'34260#Avène', 'URI_ID_du_POI':'https://data.datatourisme.fr/32/marche-test'},
            {'Nom_du_POI':'Exposition du village', 'Description':'Les ouvertures restent à vérifier.', 'Periodes_regroupees':'2026-11-01<->2027-01-01', 'Code_postal_et_commune':'34260#Avène', 'URI_ID_du_POI':'https://data.datatourisme.fr/32/exposition-test'},
        ]
        result = subprocess.run([os.environ.get('CEILHES_NODE','node'),'--input-type=module','-e',
            'import {preparerEvenements,rendreCartes} from "./scripts/agenda.mjs";console.log(rendreCartes(preparerEvenements(JSON.parse(process.argv[1]),"2026-11-14"),true));',json.dumps(source)],
            cwd=parcours.ROOT,text=True,capture_output=True,check=True)
        self.body = re.sub(r'<!-- @agenda -->.*?<!-- @/agenda -->',lambda _:'<!-- @agenda --><div class="agenda-list">'+result.stdout+'</div><!-- @/agenda -->',(parcours.ROOT/'agenda.html').read_text(),flags=re.S)
        self.page.route('**/agenda.html*',lambda route:route.fulfill(status=200,content_type='text/html',body=self.body))

    def card(self, title):
        return self.page.locator('.ev-card').filter(has=self.page.locator('h3',has_text=title))

    def download(self, link):
        link.focus()
        with self.page.expect_download() as waiting:
            self.page.keyboard.press('Enter')
        downloaded = waiting.value
        self.assertTrue(downloaded.suggested_filename.endswith('.ics'))
        return Path(downloaded.path()).read_bytes().decode('utf-8').replace('\r\n ', '')

    def test_occurrence_choisie_telechargee_au_clavier_sur_mobile(self):
        self.go('agenda.html')
        card = self.card('Marché à Avène')
        card.locator('.ev-details summary').click()
        card.locator('.ev-calendrier select').select_option('2026-11-24/2026-11-24')
        text = self.download(card.locator('.ev-calendrier-ics'))
        self.assertIn('DTSTART;VALUE=DATE:20261124\r\nDTEND;VALUE=DATE:20261125',text)
        self.assertNotIn('DTSTART;VALUE=DATE:20261117',text)
        self.assertEqual(text.count('BEGIN:VEVENT'),1)
        self.assertIn('LOCATION:Place de la mairie · 34260 Avène',text)
        self.assertIn('aucune réservation effectuée',text)
        self.assertNotIn('T150000',text)
        params = parse_qs(urlsplit(card.locator('.ev-calendrier-google').get_attribute('href')).query)
        self.assertEqual(params['dates'],['20261124/20261125'])
        expect(card.locator('.ev-calendrier')).to_contain_text('journée entière')
        self.page.set_viewport_size({'width':320,'height':700})
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth'))

    def test_filtre_restreint_les_occurrences_et_garde_la_periode_exposition(self):
        self.go('agenda.html?periode=sejour&debut=2026-11-24&fin=2026-11-24')
        market = self.card('Marché à Avène')
        market.locator('.ev-details summary').click()
        expect(market.locator('.ev-calendrier option')).to_have_count(1)
        self.assertIn('DTSTART;VALUE=DATE:20261124',self.download(market.locator('.ev-calendrier-ics')))
        exhibition = self.card('Exposition du village')
        exhibition.locator('.ev-details summary').click()
        expect(exhibition.locator('.ev-calendrier-ics')).to_have_text('Ajouter la période (.ics)')
        text = self.download(exhibition.locator('.ev-calendrier-ics'))
        self.assertEqual(text.count('BEGIN:VEVENT'),1)
        self.assertIn('DTSTART;VALUE=DATE:20261101\r\nDTEND;VALUE=DATE:20270102',text)
        self.assertNotIn('RRULE',text)
        self.assertIn('ne signifie pas une ouverture quotidienne',text)
        self.page.locator('#agenda-filtres [type=reset]').click()
        expect(market.locator('.ev-calendrier option')).to_have_count(2)

    def test_echec_telechargement_ne_promet_pas_un_ajout(self):
        self.go('agenda.html')
        card = self.card('Marché à Avène')
        card.locator('.ev-details summary').click()
        self.page.evaluate("() => { URL.createObjectURL=()=>{throw new Error('indisponible')}; }")
        card.locator('.ev-calendrier-ics').click()
        expect(card.locator('.ev-calendrier [role=status]')).to_contain_text('Le fichier ne peut pas être préparé ici')
        self.assertNotIn('#',self.page.url)

    def test_sans_javascript_details_et_dates_restant_accessibles(self):
        context = self.browser.new_context(java_script_enabled=False,viewport={'width':320,'height':700})
        try:
            context.route('**/*',lambda route:route.continue_() if urlsplit(route.request.url).hostname=='127.0.0.1' else route.abort())
            context.route('**/agenda.html*',lambda route:route.fulfill(status=200,content_type='text/html',body=self.body))
            page = context.new_page();page.goto(self.base+'agenda.html')
            card = page.locator('.ev-card').filter(has=page.locator('h3',has_text='Marché à Avène'))
            card.locator('.ev-details summary').focus();page.keyboard.press('Enter')
            expect(card.locator('.ev-description')).to_be_visible()
            expect(card.locator('.ev-dates')).to_contain_text('24 novembre 2026')
            expect(card.locator('.ev-calendrier')).to_have_count(0)
        finally:
            context.close()


if __name__ == '__main__':
    unittest.main(verbosity=2)
