"""Les détails d'un rendez-vous, avec et sans JavaScript."""
import json
import os
import re
import subprocess
import unittest
from urllib.parse import urlsplit

from playwright.sync_api import expect
import parcours


class AgendaDetails(unittest.TestCase):
    setUpClass = classmethod(parcours.Parcours.setUpClass.__func__)
    stop_server = classmethod(parcours.Parcours.stop_server.__func__)
    tearDown = parcours.Parcours.tearDown
    go = parcours.Parcours.go

    def setUp(self):
        parcours.Parcours.setUp(self)
        source = [
            {'Nom_du_POI':'Visite du village', 'Description':'Une découverte de l’histoire du village. '*8+'\nRendez-vous à 15h. Réservation au 04 67 23 43 38.',
             'Adresse_postale':'Place de la mairie', 'Code_postal_et_commune':'34260#Avène', 'Periodes_regroupees':'2026-11-17',
             'Contacts_du_POI':'Visite#https://example.org/visite', 'URI_ID_du_POI':'https://data.datatourisme.fr/32/visite-test'},
            {'Nom_du_POI':'Concert', 'Description':'Un concert annoncé.', 'Code_postal_et_commune':'34700#Lodève',
             'Periodes_regroupees':'2026-11-17', 'URI_ID_du_POI':'https://data.datatourisme.fr/32/concert-test'},
        ]
        result = subprocess.run(
            [os.environ.get('CEILHES_NODE', 'node'), '--input-type=module', '-e',
             'import {preparerEvenements,rendreCartes,identifiantEvenement} from "./scripts/agenda.mjs"; '
             'const e=preparerEvenements(JSON.parse(process.argv[1]),"2026-11-14"); '
             'console.log(JSON.stringify({html:rendreCartes(e,true),id:identifiantEvenement(e.find(x=>x.commune==="Avène"))}));',
             json.dumps(source)], cwd=parcours.ROOT, text=True, capture_output=True, check=True)
        generated = json.loads(result.stdout)
        self.event_id = generated['id']
        self.body = re.sub(r'<!-- @agenda -->.*?<!-- @/agenda -->',
                           lambda _: '<!-- @agenda --><div class="agenda-list">'+generated['html']+'</div><!-- @/agenda -->',
                           (parcours.ROOT/'agenda.html').read_text(), flags=re.S)
        self.page.route('**/agenda.html*', lambda route: route.fulfill(status=200, content_type='text/html', body=self.body))

    def test_lien_direct_revele_evenement_et_details_malgre_filtre(self):
        self.go('agenda.html?commune=Lod%C3%A8ve&campagne=test#'+self.event_id)
        card = self.page.locator('#'+self.event_id)
        expect(card).to_be_in_viewport()
        expect(card.locator('details')).to_have_attribute('open', '')
        expect(card.locator('.ev-description')).to_contain_text('Réservation au 04 67 23 43 38.')
        expect(card.locator('a[href="tel:+33467234338"]')).to_be_visible()
        expect(card.locator('.ev-adresse')).to_contain_text('Place de la mairie')
        self.assertNotIn('commune=', self.page.url)
        self.assertIn('campagne=test', self.page.url)
        self.page.set_viewport_size({'width':320, 'height':700})
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth'))

    def test_details_et_contacts_accessibles_sans_javascript(self):
        context = self.browser.new_context(java_script_enabled=False, viewport={'width':320,'height':700})
        try:
            context.route('**/*', lambda route: route.continue_() if urlsplit(route.request.url).hostname=='127.0.0.1' else route.abort())
            context.route('**/agenda.html*', lambda route: route.fulfill(status=200, content_type='text/html', body=self.body))
            page = context.new_page()
            page.goto(self.base+'agenda.html')
            card = page.locator('#'+self.event_id)
            expect(card.locator('.ev-description')).not_to_be_visible()
            card.locator('summary').focus()
            page.keyboard.press('Enter')
            expect(card.locator('.ev-description')).to_be_visible()
            expect(card.locator('.ev-description')).to_contain_text('Rendez-vous à 15h.')
            expect(card.locator('a[href="https://example.org/visite"]')).to_be_visible()
            expect(card.locator('a[href="tel:+33467234338"]')).to_have_text('Appeler le 04 67 23 43 38')
            self.assertTrue(page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        finally:
            context.close()


if __name__ == '__main__':
    unittest.main(verbosity=2)
