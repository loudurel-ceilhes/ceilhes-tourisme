"""Retrouver les références d'un producteur et conserver sa fiche, sans envoi."""
import os
from pathlib import Path
import unittest
from urllib.parse import urlsplit
from playwright.sync_api import expect
import parcours

LOCAL = 'les-eleveurs-du-rougier'
PRODUITS = ['Tomme du Rougier', 'Fondant du Rougier', 'Tomme des Pâturages']


class Rougier(unittest.TestCase):
    setUpClass = classmethod(parcours.Parcours.setUpClass.__func__)
    stop_server = classmethod(parcours.Parcours.stop_server.__func__)
    tearDown = parcours.Parcours.tearDown
    go = parcours.Parcours.go

    def setUp(self):
        parcours.Parcours.setUp(self)
        self.writes = []
        self.context.unroute('**/*')
        self.context.route('**/*', self.read_only)

    def read_only(self, route):
        if route.request.method not in ('GET', 'HEAD'):
            self.writes.append(route.request.method)
            route.abort()
        elif urlsplit(route.request.url).hostname == '127.0.0.1':
            route.continue_()
        else:
            route.abort()

    def capture(self, name):
        if destination := os.environ.get('CEILHES_PREUVES'):
            dossier = Path(destination)
            dossier.mkdir(parents=True, exist_ok=True)
            self.page.screenshot(path=str(dossier / name))

    def test_references_retrouvees_dans_trois_recherches_mobile(self):
        for width in (320, 390):
            self.page.set_viewport_size({'width': width, 'height': 844})
            for product in PRODUITS:
                with self.subTest(width=width, product=product):
                    self.go('terroir.html')
                    self.page.locator('#recherche-producteurs').fill(product)
                    self.page.locator('#esquirol-producteurs').check()
                    expect(self.page.locator('.prod-card:visible')).to_have_count(1)
                    fiche = self.page.locator('#' + LOCAL)
                    expect(fiche).to_be_visible()
                    expect(fiche.get_by_role('link', name='Itinéraire')).to_have_count(0)
                    fiche.scroll_into_view_if_needed()
                    self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
                    if product == PRODUITS[0]:
                        self.capture(f'terroir-{width}.png')
                    self.go('producteurs-region.html')
                    self.page.locator('#reseau-recherche').fill(product)
                    self.page.locator('#reseau-statut').select_option('recu')
                    expect(self.page.locator('.reseau-fiche:visible')).to_have_count(1)
                    expect(self.page.locator('#producteur-231')).to_be_visible()
                    self.go('recherche.html')
                    self.page.locator('#recherche-q').fill(product)
                    self.page.get_by_role('button', name='Rechercher', exact=True).click()
                    expect(self.page.locator('#recherche-resultats a[href="/terroir.html#' + LOCAL + '"]')).to_have_count(1)
                    self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= innerWidth'))

    def test_fiche_carnet_et_correction_contextuelle_sans_envoi(self):
        self.go('terroir.html#' + LOCAL)
        fiche = self.page.locator('#' + LOCAL)
        fiche.locator('.carnet-ajouter').click()
        self.go('mon-sejour.html')
        expect(self.page.locator('.carnet-fiche')).to_have_count(1)
        expect(self.page.locator('.carnet-fiche a[href="/terroir.html#' + LOCAL + '"]')).to_have_count(1)
        self.go('terroir.html#' + LOCAL)
        self.page.locator('#' + LOCAL).get_by_role('link', name='Corriger cette fiche', exact=True).click()
        expect(self.page.locator('#contribution-fiche')).to_have_value('https://ceilhes-tourisme.fr/terroir.html#' + LOCAL)
        expect(self.page.locator('#contribution-contexte')).to_contain_text('Les Éleveurs du Rougier')
        self.page.locator('#contribution-correction').fill('Essai local de correction, ne pas envoyer.')
        self.page.get_by_role('button', name='Préparer le message').click()
        expect(self.page.locator('#contribution-apercu')).to_be_visible()
        expect(self.page.locator('#contribution-statut')).to_contain_text('Rien n’a été envoyé')
        self.assertEqual(self.writes, [])

    def test_fiches_et_circuit_sans_javascript_mobile(self):
        context = self.browser.new_context(java_script_enabled=False, viewport={'width': 320, 'height': 844})
        context.route('**/*', self.read_only)
        try:
            page = context.new_page()
            page.goto(self.base + 'terroir.html#' + LOCAL)
            fiche = page.locator('#' + LOCAL)
            expect(fiche).to_be_visible()
            expect(fiche.locator('.prod-produits li')).to_have_count(3)
            expect(fiche.locator('a[href*="/nos-producteurs"]')).to_have_count(1)
            self.assertTrue(page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
            page.goto(self.base + 'circuits-producteurs.html#fromages-eleveurs-rougier')
            note = page.locator('#fromages-eleveurs-rougier')
            expect(note).to_be_visible()
            expect(note.locator('[data-carnet-id]')).to_have_count(0)
            expect(note.locator('a[href="terroir.html#' + LOCAL + '"]')).to_have_count(1)
            self.assertTrue(page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
            if destination := os.environ.get('CEILHES_PREUVES'):
                note.evaluate("element => element.scrollIntoView({block: 'start', behavior: 'instant'})")
                page.screenshot(path=str(Path(destination) / 'circuit-320-sans-js.png'))
            self.assertEqual(self.writes, [])
        finally:
            context.close()


if __name__ == '__main__':
    unittest.main()
