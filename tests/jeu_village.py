"""Carnet découverte : réponses locales, repli sans script et papier séparé."""
import unittest
from playwright.sync_api import expect
import parcours


class JeuVillage(unittest.TestCase):
    setUpClass = classmethod(parcours.Parcours.setUpClass.__func__)
    stop_server = classmethod(parcours.Parcours.stop_server.__func__)
    setUp = parcours.Parcours.setUp
    tearDown = parcours.Parcours.tearDown
    go = parcours.Parcours.go

    def test_mobile_carnet_recharge_et_effacement_annulable(self):
        self.page.set_viewport_size({'width': 320, 'height': 740})
        self.go('jeu-village.html')
        self.assertEqual(self.page.evaluate('document.documentElement.scrollWidth'), 320)
        self.page.locator('#reponse-1').fill('Une horloge')
        self.page.locator('#reponse-2').fill('Le reflet dans l’Orb')
        expect(self.page.locator('[data-jeu-compte]')).to_have_text('2 réponses notées sur 7')
        self.page.reload()
        expect(self.page.locator('#reponse-1')).to_have_value('Une horloge')
        expect(self.page.locator('#reponse-2')).to_have_value('Le reflet dans l’Orb')
        self.page.once('dialog', lambda dialog: dialog.dismiss())
        self.page.locator('[data-jeu-effacer]').click()
        expect(self.page.locator('#reponse-1')).to_have_value('Une horloge')
        self.page.once('dialog', lambda dialog: dialog.accept())
        self.page.locator('[data-jeu-effacer]').click()
        expect(self.page.locator('[data-jeu-compte]')).to_have_text('0 réponse notée sur 7')
        expect(self.page.locator('#reponse-1')).to_be_focused()
        self.page.reload()
        expect(self.page.locator('#reponse-1')).to_have_value('')

    def test_stockage_refuse_ne_promet_pas_de_sauvegarde(self):
        self.context.add_init_script("""Object.defineProperty(window, 'localStorage', {
            get() { throw new DOMException('Stockage refusé', 'SecurityError'); }
        });""")
        self.go('jeu-village.html')
        self.page.locator('#reponse-3').fill('Chercher de l’eau')
        expect(self.page.locator('[data-jeu-stockage]')).to_contain_text('ne permet pas de conserver')
        expect(self.page.locator('[data-jeu-compte]')).to_have_text('1 réponse notée sur 7')
        self.page.locator('#solutions > summary').click()
        expect(self.page.locator('.jeu-corrige')).to_be_visible()

    def test_donnees_corrompues_et_texte_non_interprete(self):
        self.go('jeu-village.html')
        self.page.evaluate("localStorage.setItem('ceilhes:jeu-village:v1', '{invalide')")
        self.page.reload()
        expect(self.page.locator('[data-jeu-compte]')).to_have_text('0 réponse notée sur 7')
        payload = '<img src=x onerror="window.injection=true">'
        self.page.locator('#reponse-1').fill(payload)
        self.page.reload()
        expect(self.page.locator('#reponse-1')).to_have_value(payload)
        self.assertIsNone(self.page.evaluate('window.injection'))

    def test_solutions_au_clavier_sans_changer_la_progression(self):
        self.go('jeu-village.html')
        summary = self.page.locator('#solutions > summary')
        expect(self.page.locator('.jeu-corrige')).not_to_be_visible()
        summary.focus()
        summary.press('Enter')
        expect(self.page.locator('.jeu-corrige')).to_be_visible()
        expect(self.page.locator('[data-jeu-compte]')).to_have_text('0 réponse notée sur 7')
        self.page.set_viewport_size({'width': 1366, 'height': 900})
        self.assertEqual(self.page.evaluate('document.documentElement.scrollWidth'), 1366)

    def test_questions_et_solutions_imprimees_separement(self):
        self.go('jeu-village.html')
        self.page.evaluate('window.print = () => { window.printCalled = true; }')
        self.page.locator('[data-jeu-print="solutions"]').first.click()
        self.assertTrue(self.page.evaluate('window.printCalled'))
        self.page.emulate_media(media='print')
        expect(self.page.locator('.jeu-questions-section')).not_to_be_visible()
        expect(self.page.locator('.jeu-corrige')).to_be_visible()
        expect(self.page.locator('.jeu-impression-titre')).to_be_visible()
        self.page.evaluate("window.dispatchEvent(new Event('afterprint'))")
        self.assertFalse(self.page.locator('#solutions').evaluate('(element) => element.open'))
        expect(self.page.locator('.jeu-questions-section')).to_be_visible()
        expect(self.page.locator('.jeu-solutions-section')).not_to_be_visible()
        expect(self.page.locator('.jeu-papier:visible')).to_have_count(7)
        expect(self.page.locator('.jeu-reponse:visible')).to_have_count(0)

    def test_sans_javascript_indices_et_corrige_restent_lisibles(self):
        context = self.browser.new_context(java_script_enabled=False, viewport={'width': 390, 'height': 800})
        self.addCleanup(context.close)
        page = context.new_page()
        page.goto(self.base + 'jeu-village.html')
        expect(page.locator('[data-jeu-reponse]')).to_have_count(7)
        page.locator('#enigme-1 summary').click()
        expect(page.locator('#enigme-1 details p')).to_be_visible()
        page.locator('#solutions > summary').click()
        expect(page.locator('.jeu-corrige li')).to_have_count(7)
        expect(page.locator('.jeu-corrige')).to_be_visible()
        expect(page.locator('[data-jeu-compte]')).not_to_be_visible()


if __name__ == '__main__':
    unittest.main()
