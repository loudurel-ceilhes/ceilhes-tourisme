"""Le groupe de guides reste accessible au clavier sur mobile et ordinateur."""
import unittest
from playwright.sync_api import expect
import parcours


class NavigationGuides(unittest.TestCase):
    setUpClass = classmethod(parcours.Parcours.setUpClass.__func__)
    stop_server = classmethod(parcours.Parcours.stop_server.__func__)
    setUp = parcours.Parcours.setUp
    tearDown = parcours.Parcours.tearDown
    go = parcours.Parcours.go

    def test_menu_mobile_groupe_et_retour_clavier(self):
        self.go()
        self.page.locator('#burger').click()
        summary = self.page.locator('.nav-guides summary')
        summary.focus()
        summary.press('Enter')
        expect(self.page.locator('.nav-guides')).to_have_attribute('open', '')
        self.page.keyboard.press('Escape')
        expect(summary).to_be_focused()
        expect(self.page.locator('#burger')).to_have_attribute('aria-expanded', 'true')
        self.page.keyboard.press('Escape')
        expect(self.page.locator('#burger')).to_be_focused()
        expect(self.page.locator('#burger')).to_have_attribute('aria-expanded', 'false')
        self.page.locator('#burger').click()
        summary.click()
        self.page.locator('.nav-guides a[href="guide-curistes-avene.html"]').click()
        expect(self.page.locator('h1')).to_contain_text('Trois semaines')
        expect(self.page.locator('#burger')).to_have_attribute('aria-expanded', 'false')
        self.assertEqual(self.page.evaluate('document.documentElement.scrollWidth'), 390)

    def test_guides_sur_ordinateur_et_fermeture_hors_menu(self):
        self.page.set_viewport_size({'width': 1366, 'height': 900})
        self.go('infos-pratiques.html')
        summary = self.page.locator('.nav-guides summary')
        summary.click()
        expect(self.page.locator('.nav-guides-list a')).to_have_count(5)
        self.page.locator('h1').click()
        self.assertFalse(self.page.locator('.nav-guides').evaluate('(el) => el.open'))
        summary.click()
        self.page.locator('.nav-guides a[href="kit-hebergeurs.html"]').click()
        expect(self.page.locator('h1')).to_contain_text('kit')
        self.assertEqual(self.page.evaluate('document.documentElement.scrollWidth'), 1366)


if __name__ == '__main__':
    unittest.main()
