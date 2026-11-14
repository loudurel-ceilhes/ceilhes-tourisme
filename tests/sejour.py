"""Programmes de séjour : python3 tests/sejour.py."""
import unittest
from urllib.parse import urlsplit
from playwright.sync_api import expect
import parcours


class Sejour(unittest.TestCase):
    # Partager le serveur et le navigateur, sans rejouer les autres parcours.
    setUpClass = classmethod(parcours.Parcours.setUpClass.__func__)
    stop_server = classmethod(parcours.Parcours.stop_server.__func__)
    setUp = parcours.Parcours.setUp
    tearDown = parcours.Parcours.tearDown
    go = parcours.Parcours.go

    def test_choix_au_clavier_et_liens_pratiques(self):
        self.go()
        tabs = self.page.locator('.sejour-choix [role=tab]')
        expect(tabs).to_have_count(4)
        expect(self.page.locator('.sejour-parcours article:visible')).to_have_count(1)
        tabs.first.focus()
        self.page.keyboard.press('End')
        expect(tabs.last).to_be_focused()
        expect(tabs.last).to_have_attribute('aria-selected', 'true')
        expect(self.page.locator('#programme-pluie')).to_be_visible()
        self.page.keyboard.press('ArrowRight')
        expect(tabs.first).to_be_focused()
        expect(self.page.locator('#programme-journee')).to_be_visible()
        expect(self.page.locator('#programme-journee .sejour-etapes li')).to_have_count(3)
        expect(self.page.locator('.sejour-acces a').nth(2)).to_have_attribute('href', 'infos-pratiques.html#manger')
        expect(self.page.locator('.sejour-rendezvous a')).to_have_attribute('href', 'agenda.html?periode=weekend#agenda-list')
        self.page.set_viewport_size({'width':320,'height':568})
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth'))

    def test_impression_du_programme_et_retablissement(self):
        self.go()
        self.page.locator('.sejour-choix [data-programme=enfants]').click()
        self.page.evaluate('window.print = () => { window.impressionDemandee = true; }')
        self.page.locator('#imprimer-programme').click()
        self.assertTrue(self.page.evaluate('window.impressionDemandee'))
        # Sur écran, la page est toujours présente pendant la boîte d'impression.
        expect(self.page.locator('#hero')).to_be_visible()
        self.page.emulate_media(media='print')
        expect(self.page.locator('#hero')).not_to_be_visible()
        expect(self.page.locator('#village')).not_to_be_visible()
        expect(self.page.locator('#programme-enfants')).to_be_visible()
        expect(self.page.locator('.sejour-parcours article:visible')).to_have_count(1)
        expect(self.page.locator('.sejour-choix')).not_to_be_visible()
        self.page.evaluate('window.dispatchEvent(new Event("afterprint"))')
        self.page.emulate_media(media='screen')
        expect(self.page.locator('#hero')).to_be_visible()
        expect(self.page.locator('.sejour-choix')).to_be_visible()
        self.assertFalse(self.page.locator('body').evaluate('(e)=>e.classList.contains("imprimer-programme")'))
        # Une impression normale ultérieure n'isole plus le programme.
        self.page.emulate_media(media='print')
        expect(self.page.locator('#village')).to_be_visible()

    def test_adresse_rechargement_et_retour_navigateur(self):
        self.go('?origine=partage#programme-weekend')
        expect(self.page.locator('#programme-weekend')).to_be_visible()
        self.page.locator('.sejour-choix [data-programme=enfants]').click()
        self.assertEqual(urlsplit(self.page.url).query, 'origine=partage')
        self.assertEqual(urlsplit(self.page.url).fragment, 'programme-enfants')
        self.page.reload()
        expect(self.page.locator('#programme-enfants')).to_be_visible()
        self.page.go_back()
        expect(self.page.locator('#programme-weekend')).to_be_visible()
        self.page.go_forward()
        expect(self.page.locator('#programme-enfants')).to_be_visible()
        # Un lien vers une ancre de programme masque les autres programmes et
        # dévoile sa cible, même si la page était déjà ouverte.
        self.page.evaluate('location.hash = "programme-pluie"')
        expect(self.page.locator('#programme-pluie')).to_be_visible()
        expect(self.page.locator('#programme-pluie')).to_be_in_viewport()
        expect(self.page.locator('.sejour-choix [data-programme=pluie]')).to_have_attribute('aria-selected', 'true')
        self.page.go_back()
        expect(self.page.locator('#programme-enfants')).to_be_visible()

    def test_copie_du_lien_et_repli_manuel(self):
        self.go('?origine=amis')
        self.page.evaluate('''Object.defineProperty(navigator, 'clipboard', {
            configurable: true, value: {writeText: async value => {window.lienCopie = value;}}
        })''')
        self.page.locator('.sejour-choix [data-programme=weekend]').click()
        self.page.locator('#partager-programme').click()
        copied = self.page.evaluate('window.lienCopie')
        self.assertEqual(copied, self.base+'?origine=amis#programme-weekend')
        expect(self.page.locator('#sejour-partage-retour')).to_contain_text('est copié')
        expect(self.page.locator('#sejour-lien-manuel')).not_to_be_visible()
        self.page.evaluate('''Object.defineProperty(navigator, 'clipboard', {
            configurable: true, value: {writeText: async () => {throw new Error('refus');}}
        })''')
        self.page.locator('.sejour-choix [data-programme=enfants]').click()
        self.page.locator('#partager-programme').click()
        expect(self.page.locator('#sejour-lien')).to_be_focused()
        expect(self.page.locator('#sejour-lien')).to_have_value(self.base+'?origine=amis#programme-enfants')
        self.assertTrue(self.page.locator('#sejour-lien').evaluate('(input) => input.selectionEnd === input.value.length'))
        self.page.set_viewport_size({'width':320,'height':568})
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        self.page.locator('.sejour-choix [data-programme=journee]').click()
        expect(self.page.locator('#sejour-lien-manuel')).not_to_be_visible()
        expect(self.page.locator('#sejour-partage-retour')).to_be_empty()

    def test_programmes_sans_javascript(self):
        context = self.browser.new_context(java_script_enabled=False, viewport={'width':320,'height':568})
        try:
            context.route('**/*', lambda route: route.continue_() if urlsplit(route.request.url).hostname=='127.0.0.1' else route.abort())
            page = context.new_page()
            page.goto(self.base)
            expect(page.locator('.sejour-parcours article:visible')).to_have_count(4)
            expect(page.locator('.sejour-etapes li')).to_have_count(12)
            expect(page.locator('.sejour-choix')).not_to_be_visible()
            expect(page.locator('#imprimer-programme')).not_to_be_visible()
            expect(page.locator('#partager-programme')).not_to_be_visible()
            self.assertTrue(page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        finally:
            context.close()


if __name__ == '__main__':
    unittest.main(verbosity=2)
