"""Filtres des traces : python3 tests/randonnees.py."""
import unittest
from urllib.parse import parse_qs, urlsplit

from playwright.sync_api import expect
import parcours as harness


class Randonnees(unittest.TestCase):
    # Réutilise le serveur et le navigateur de la suite commune, sans rejouer
    # ses scénarios hérités dans cette suite spécifique.
    setUpClass = classmethod(harness.Parcours.setUpClass.__func__)
    stop_server = classmethod(harness.Parcours.stop_server.__func__)
    setUp = harness.Parcours.setUp
    tearDown = harness.Parcours.tearDown
    go = harness.Parcours.go

    def test_durees_types_et_aucun_resultat(self):
        self.go('randonnees.html')
        rows = self.page.locator('#toutes-randos tbody tr:not([hidden])')
        total = rows.count()
        self.page.locator('#rando-type').select_option('pied')
        self.page.locator('#rando-duree').select_option('2h')
        expect(rows.locator('.r-link')).to_have_text(['Mourgis', 'Boucle Ceilhes & Rocozels'])
        self.page.locator('#rando-duree').select_option('itinerance')
        expect(rows).to_have_count(1)
        expect(rows.locator('.r-link')).to_contain_text('Ceilhes → Octon (3 jours)')
        self.page.locator('#rando-type').select_option('vtt')
        expect(rows).to_have_count(0)
        expect(self.page.locator('#rando-aucun')).to_be_visible()
        expect(self.page.locator('#rando-compteur')).to_contain_text('0 trace')
        self.page.locator('#rando-filtres [type=reset]').click()
        expect(rows).to_have_count(total)
        expect(self.page.locator('#rando-aucun')).not_to_be_visible()

    def test_adresse_partageable_et_retour(self):
        self.go('randonnees.html?source=essai&type=vtt&duree=4h#toutes-randos')
        rows = self.page.locator('#toutes-randos tbody tr:not([hidden])')
        expect(self.page.locator('#rando-type')).to_have_value('vtt')
        expect(self.page.locator('#rando-duree')).to_have_value('4h')
        expect(rows).to_have_count(1)
        expect(rows.locator('.r-link')).to_have_text('Avène – Ceilhes')
        self.page.locator('#rando-duree').select_option('2h')
        expect(rows).to_have_count(0)
        self.assertEqual(parse_qs(urlsplit(self.page.url).query), {'source':['essai'],'type':['vtt'],'duree':['2h']})
        self.page.go_back()
        expect(self.page.locator('#rando-duree')).to_have_value('4h')
        expect(rows).to_have_count(1)
        self.page.reload()
        expect(rows).to_have_count(1)
        self.page.locator('#rando-filtres [type=reset]').click()
        self.assertEqual(parse_qs(urlsplit(self.page.url).query), {'source':['essai']})

    def test_raccourcis_et_copie_de_secours(self):
        self.go('randonnees.html?source=essai')
        self.page.locator('[data-trace-type=vtt]').click()
        expect(self.page.locator('#toutes-randos tbody tr:not([hidden])')).to_have_count(1)
        expect(self.page.locator('#toutes-randos')).to_be_focused()
        self.assertEqual(parse_qs(urlsplit(self.page.url).query), {'source':['essai'],'type':['vtt']})
        self.page.locator('[data-trace-type=pied]').click()
        expect(self.page.locator('#rando-type')).to_have_value('pied')
        self.assertTrue(self.page.locator('#toutes-randos tbody tr:not([hidden])').evaluate_all('(es)=>es.every(e=>e.dataset.type==="pied")'))
        self.page.evaluate('Object.defineProperty(navigator,"clipboard",{configurable:true,value:undefined})')
        self.page.locator('#rando-partager').click()
        expect(self.page.locator('#rando-lien')).to_be_visible()
        self.assertIn('type=pied', self.page.locator('#rando-lien').input_value())
        self.assertIn('source=essai', self.page.locator('#rando-lien').input_value())
        self.page.locator('.filter-chips [data-lv=sportif]').click()
        expect(self.page.locator('#balade-bouloc')).not_to_be_visible()
        self.page.locator('[data-petites-balades]').click()
        expect(self.page.locator('#balade-bouloc')).to_be_visible()

    def test_petit_ecran_et_sans_javascript(self):
        self.page.set_viewport_size({'width':320,'height':568})
        self.go('randonnees.html')
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        self.page.locator('[data-trace-type=vtt]').click()
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        nojs = self.browser.new_context(java_script_enabled=False, viewport={'width':320,'height':568})
        try:
            page = nojs.new_page()
            page.goto(self.base+'randonnees.html?type=vtt#toutes-randos')
            expect(page.locator('#rando-filtres')).not_to_be_visible()
            rows = page.locator('#toutes-randos tbody tr')
            expect(page.locator('#toutes-randos tbody tr:visible')).to_have_count(rows.count())
            expect(rows.first.locator('.r-cell-label')).to_have_text(['Type', 'Distance', 'Dénivelé', 'Durée', 'Niveau'])
            expect(rows.first.locator('.r-cell-label').last).to_be_visible()
            self.assertTrue(rows.evaluate_all('(rows)=>rows.every(row=>row.scrollWidth<=row.clientWidth)'))
            self.assertTrue(page.locator('[data-petites-balades]').get_attribute('href').startswith('#'))
            self.assertTrue(page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        finally:
            nojs.close()

    def test_donnees_comparables_sans_defilement_horizontal(self):
        self.go('randonnees.html#toutes-randos')
        first = self.page.locator('#toutes-randos tbody tr').first
        expect(first.locator('.r-cell-value')).to_have_text(['À pied', '6,3 km', '+312 m', '2 h 10', 'Très facile'])
        expect(self.page.get_by_role('columnheader', name='Dénivelé')).to_have_count(1)
        for width in (320, 390, 768, 1440):
            with self.subTest(width=width):
                self.page.set_viewport_size({'width':width, 'height':900})
                first.scroll_into_view_if_needed()
                self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
                self.assertTrue(first.locator('td').evaluate_all('(cells)=>cells.every(cell=>cell.getBoundingClientRect().right<=innerWidth && cell.scrollWidth<=cell.clientWidth)'))
                if width <= 800:
                    expect(first.locator('.r-cell-label').last).to_be_visible()
                else:
                    expect(first.locator('.r-cell-label').last).not_to_be_visible()


if __name__ == '__main__':
    unittest.main(verbosity=2)
