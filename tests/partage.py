"""Liens de filtres partageables : python3 tests/partage.py."""
import html
import json
import re
import unittest
from urllib.parse import parse_qs, urlencode, urlsplit

from playwright.sync_api import expect
import parcours


class Partage(unittest.TestCase):
    # Réutiliser uniquement le serveur et le navigateur, sans rejouer les
    # méthodes test_* de la suite générale.
    setUpClass = classmethod(parcours.Parcours.setUpClass.__func__)
    stop_server = classmethod(parcours.Parcours.stop_server.__func__)
    setUp = parcours.Parcours.setUp
    tearDown = parcours.Parcours.tearDown
    go = parcours.Parcours.go

    def query(self):
        return parse_qs(urlsplit(self.page.url).query)

    def producer_ids(self):
        return self.page.locator('#annuaire-producteurs .prod-card:not([hidden])').evaluate_all('(es)=>es.map(e=>e.id)')

    def agenda_fixture(self):
        fixtures = [
            ('Concert samedi', 'Avène', 'Concert', '2026-11-14', '2026-11-14'),
            ('Marché dimanche', 'Ceilhes-et-Rocozels', 'Marché', '2026-11-15', '2026-11-15'),
            ('Exposition en cours', 'Avène', 'Exposition', '2026-11-01', '2026-11-30'),
            ('Concert lundi', 'Lodève', 'Concert', '2026-11-16', '2026-11-16'),
        ]
        cards = []
        for name, town, activity, start, end in fixtures:
            dates = html.escape(json.dumps([{'debut': start, 'fin': end}]), quote=True)
            cards.append(f'<article class="ev-card" data-periodes="{dates}" data-commune="{town}" data-activite="{activity}"><div class="ev-body"><span class="ev-lieu">{town}</span><span class="ev-tag">{activity}</span><h3>{name}</h3></div></article>')
        body = re.sub(r'<!-- @agenda -->.*?<!-- @/agenda -->',
                      lambda _: '<!-- @agenda --><div class="agenda-list">'+''.join(cards)+'</div><!-- @/agenda -->',
                      (parcours.ROOT/'agenda.html').read_text(), flags=re.S)
        self.page.route('**/agenda.html*', lambda route: route.fulfill(status=200, content_type='text/html', body=body))

    def test_producteurs_lien_accentue_et_valeurs_inconnues(self):
        query = urlencode({'q': 'Avène', 'produit': 'inconnu', 'zone': '99',
                           'esquirol': 'peut-etre', 'campagne': 'été'})
        self.go('terroir.html?'+query+'#annuaire-producteurs')
        expect(self.page.locator('#recherche-producteurs')).to_have_value('Avène')
        expect(self.page.locator('#produit-producteurs')).to_have_value('')
        expect(self.page.locator('#zone-producteurs')).to_have_value('')
        expect(self.page.locator('#esquirol-producteurs')).not_to_be_checked()
        ids = self.producer_ids()
        self.assertGreater(len(ids), 0)
        self.assertTrue(self.page.locator('#annuaire-producteurs .prod-card:not([hidden])').evaluate_all(
            '(es)=>es.every(e=>e.textContent.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().includes("avene"))'))
        self.page.reload(wait_until='load')
        self.assertEqual(self.producer_ids(), ids)
        self.page.locator('#filtres-producteurs [type=reset]').click()
        self.assertEqual(self.query(), {'campagne': ['été']})
        self.assertEqual(urlsplit(self.page.url).fragment, 'annuaire-producteurs')

    def test_producteurs_ecriture_reload_et_historique_conserves(self):
        self.go('terroir.html?campagne=ete#annuaire-producteurs')
        self.page.evaluate('history.replaceState({origine:"test"}, "", location.href)')
        history_length = self.page.evaluate('history.length')
        self.page.locator('#recherche-producteurs').fill('œufs')
        self.page.locator('#produit-producteurs').select_option('viandes')
        self.page.locator('#zone-producteurs').select_option('0')
        self.page.locator('#esquirol-producteurs').check()
        self.assertEqual(self.query(), {'campagne': ['ete'], 'q': ['œufs'],
                                       'produit': ['viandes'], 'zone': ['0'], 'esquirol': ['1']})
        self.assertEqual(urlsplit(self.page.url).fragment, 'annuaire-producteurs')
        self.assertEqual(self.page.evaluate('history.length'), history_length)
        self.assertEqual(self.page.evaluate('history.state'), {'origine': 'test'})
        ids = self.producer_ids()
        self.page.reload(wait_until='load')
        expect(self.page.locator('#recherche-producteurs')).to_have_value('œufs')
        expect(self.page.locator('#produit-producteurs')).to_have_value('viandes')
        expect(self.page.locator('#zone-producteurs')).to_have_value('0')
        expect(self.page.locator('#esquirol-producteurs')).to_be_checked()
        self.assertEqual(self.producer_ids(), ids)
        self.page.locator('#filtres-producteurs [type=reset]').click()
        self.assertEqual(self.query(), {'campagne': ['ete']})

    def test_producteurs_retour_et_popstate(self):
        self.go('terroir.html?q=Av%C3%A8ne#annuaire-producteurs')
        avène = self.producer_ids()
        self.page.evaluate('history.pushState({essai:2}, "", "?q=roquefort#annuaire-producteurs"); dispatchEvent(new PopStateEvent("popstate", {state:history.state}))')
        expect(self.page.locator('#recherche-producteurs')).to_have_value('roquefort')
        self.assertNotEqual(self.producer_ids(), avène)
        self.page.go_back()
        expect(self.page.locator('#recherche-producteurs')).to_have_value('Avène')
        self.assertEqual(self.producer_ids(), avène)
        self.go('index.html')
        self.page.go_back(wait_until='load')
        expect(self.page.locator('#recherche-producteurs')).to_have_value('Avène')
        self.assertEqual(self.producer_ids(), avène)

    def test_agenda_lien_partage_reload_et_reset(self):
        self.agenda_fixture()
        query = urlencode({'periode': 'weekend', 'commune': 'Avène', 'activite': 'Concert', 'campagne': 'été'})
        self.go('agenda.html?'+query+'#agenda-list')
        cards = self.page.locator('#agenda-list .ev-card:not([hidden])')
        expect(cards.locator('h3')).to_have_text(['Concert samedi'])
        expect(self.page.locator('#agenda-periode')).to_have_value('weekend')
        expect(self.page.locator('#agenda-commune')).to_have_value('Avène')
        expect(self.page.locator('#agenda-activite')).to_have_value('Concert')
        self.page.reload(wait_until='load')
        expect(cards.locator('h3')).to_have_text(['Concert samedi'])
        self.page.locator('#agenda-filtres [type=reset]').click()
        expect(cards).to_have_count(4)
        self.assertEqual(self.query(), {'campagne': ['été']})
        self.assertEqual(urlsplit(self.page.url).fragment, 'agenda-list')

    def test_agenda_options_inconnues_et_modification_sans_entree_historique(self):
        self.agenda_fixture()
        self.go('agenda.html?periode=hier&commune=inconnue&activite=inconnue&campagne=ete#agenda-list')
        expect(self.page.locator('#agenda-periode')).to_have_value('tous')
        expect(self.page.locator('#agenda-commune')).to_have_value('toutes')
        expect(self.page.locator('#agenda-activite')).to_have_value('toutes')
        expect(self.page.locator('#agenda-list .ev-card:not([hidden])')).to_have_count(4)
        self.page.evaluate('history.replaceState({origine:"agenda"}, "", location.href)')
        history_length = self.page.evaluate('history.length')
        self.page.locator('#agenda-commune').select_option('Avène')
        self.page.locator('#agenda-activite').select_option('Exposition')
        self.page.locator('#agenda-periode').select_option('weekend')
        self.assertEqual(self.query(), {'campagne': ['ete'], 'periode': ['weekend'],
                                       'commune': ['Avène'], 'activite': ['Exposition']})
        self.assertEqual(self.page.evaluate('history.length'), history_length)
        self.assertEqual(self.page.evaluate('history.state'), {'origine': 'agenda'})
        expect(self.page.locator('#agenda-list .ev-card:not([hidden]) h3')).to_have_text(['Exposition en cours'])

    def test_agenda_retour_et_popstate(self):
        self.agenda_fixture()
        self.go('agenda.html?periode=weekend&commune=Av%C3%A8ne#agenda-list')
        cards = self.page.locator('#agenda-list .ev-card:not([hidden])')
        expect(cards).to_have_count(2)
        self.page.evaluate('history.pushState(null, "", "?commune=Lod%C3%A8ve#agenda-list"); dispatchEvent(new PopStateEvent("popstate"))')
        expect(self.page.locator('#agenda-commune')).to_have_value('Lodève')
        expect(self.page.locator('#agenda-periode')).to_have_value('tous')
        expect(cards.locator('h3')).to_have_text(['Concert lundi'])
        self.page.go_back()
        expect(self.page.locator('#agenda-commune')).to_have_value('Avène')
        expect(self.page.locator('#agenda-periode')).to_have_value('weekend')
        expect(cards).to_have_count(2)


if __name__ == '__main__':
    unittest.main(verbosity=2)
