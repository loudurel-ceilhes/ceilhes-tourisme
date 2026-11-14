"""Carnet personnel : navigation, stockage, impression et données invalides."""
import json
import unittest
from urllib.parse import urlsplit
from playwright.sync_api import expect
import parcours


KEY = 'ceilhes:mon-sejour:v1'


class Carnet(unittest.TestCase):
    setUpClass = classmethod(parcours.Parcours.setUpClass.__func__)
    stop_server = classmethod(parcours.Parcours.stop_server.__func__)
    setUp = parcours.Parcours.setUp
    tearDown = parcours.Parcours.tearDown
    go = parcours.Parcours.go

    def test_selection_sur_plusieurs_pages_retrait_annulation_et_impression(self):
        self.go('terroir.html')
        producer = self.page.locator('.prod-card').first
        title = producer.get_attribute('data-carnet-title')
        producer.locator('.carnet-ajouter').click()
        expect(producer.locator('.carnet-ajouter')).to_have_attribute('aria-pressed', 'true')
        self.go('randonnees.html')
        trail = self.page.locator('#balade-bouloc .carnet-ajouter')
        trail.click()
        expect(trail).to_have_attribute('aria-pressed', 'true')
        self.go('mon-sejour.html')
        expect(self.page.locator('.carnet-fiche')).to_have_count(2)
        expect(self.page.locator('.carnet-fiche h2').first).to_have_text(title)
        self.page.reload()
        expect(self.page.locator('.carnet-fiche')).to_have_count(2)
        self.page.locator('.carnet-retirer').first.click()
        expect(self.page.locator('.carnet-fiche')).to_have_count(1)
        self.page.locator('#carnet-annuler').click()
        expect(self.page.locator('.carnet-fiche h2').first).to_have_text(title)
        self.page.evaluate('window.print = () => {window.imprime = true}')
        self.page.locator('#carnet-imprimer').click()
        self.assertTrue(self.page.evaluate('window.imprime'))
        self.page.emulate_media(media='print')
        expect(self.page.locator('.carnet-fiche')).to_have_count(2)
        expect(self.page.locator('.carnet-url').first).to_be_visible()
        expect(self.page.locator('#nav')).not_to_be_visible()
        expect(self.page.locator('.carnet-retirer').first).not_to_be_visible()
        self.page.emulate_media(media='screen')
        self.go('terroir.html')
        expect(self.page.locator('.prod-card .carnet-ajouter').first).to_have_attribute('aria-pressed', 'true')

    def test_carnet_vide_sans_javascript_et_petits_ecrans(self):
        self.go('mon-sejour.html')
        expect(self.page.locator('#carnet-vide')).to_be_visible()
        expect(self.page.locator('#carnet-actions')).not_to_be_visible()
        for width in (320, 390, 1200, 1440):
            self.page.set_viewport_size({'width':width,'height':800})
            self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
        context = self.browser.new_context(java_script_enabled=False, viewport={'width':320,'height':700})
        try:
            context.route('**/*', lambda r:r.continue_() if urlsplit(r.request.url).hostname == '127.0.0.1' else r.abort())
            page = context.new_page()
            page.goto(self.base+'mon-sejour.html')
            expect(page.locator('#carnet-sans-js')).to_be_visible()
            expect(page.locator('#carnet-sans-js a').first).to_have_attribute('href', 'index.html#idees-sejour')
            expect(page.locator('#carnet-contenu')).not_to_be_visible()
        finally:
            context.close()

    def test_stockage_corrompu_et_liens_non_surs(self):
        self.go('mon-sejour.html')
        self.page.evaluate('(key)=>localStorage.setItem(key,"{cassé")', KEY)
        self.page.reload()
        expect(self.page.locator('#carnet-stockage')).to_contain_text('illisible')
        data = {'version':1,'items':[
            {'id':'sans-danger','title':'<img src=x onerror=alert(1)>','category':'Adresse','url':'infos-pratiques.html#manger'},
            {'id':'script','title':'Script','category':'Adresse','url':'javascript:alert(1)'},
            {'id':'faux-site','title':'Faux site','category':'Adresse','url':'https://example.org/'},
            {'id':'faux-fichier','title':'Fichier','category':'Adresse','url':'/assets/script.js'},
            {'id':'sans-danger','title':'Doublon','category':'Adresse','url':'infos-pratiques.html#manger'},
        ]}
        self.page.evaluate('([key,data])=>localStorage.setItem(key,JSON.stringify(data))',[KEY,data])
        self.page.reload()
        expect(self.page.locator('.carnet-fiche')).to_have_count(1)
        expect(self.page.locator('.carnet-fiche h2')).to_have_text('<img src=x onerror=alert(1)>')
        expect(self.page.locator('.carnet-fiche img')).to_have_count(0)
        expect(self.page.locator('.carnet-fiche a')).to_have_attribute('href','/infos-pratiques.html#manger')

    def test_refus_stockage_ne_promet_pas_un_enregistrement(self):
        self.context.add_init_script("""Object.defineProperty(Storage.prototype,'setItem',{
            value(){throw new DOMException('Stockage refusé','QuotaExceededError')}})""")
        self.go('terroir.html')
        button = self.page.locator('.prod-card .carnet-ajouter').first
        button.click()
        expect(button).to_have_attribute('aria-pressed','false')
        expect(self.page.locator('.carnet-retour')).to_contain_text("pas pu enregistrer")

    def test_synchronisation_entre_onglets(self):
        self.go('mon-sejour.html')
        other = self.context.new_page()
        try:
            other.goto(self.base+'randonnees.html')
            other.locator('#balade-bouloc .carnet-ajouter').click()
            expect(self.page.locator('.carnet-fiche')).to_have_count(1)
            self.page.locator('.carnet-retirer').click()
            expect(other.locator('#balade-bouloc .carnet-ajouter')).to_have_attribute('aria-pressed','false')
        finally:
            other.close()

    def test_annulation_reessayable_apres_refus_enregistrement(self):
        self.go('randonnees.html')
        self.page.locator('#balade-bouloc .carnet-ajouter').click()
        self.go('mon-sejour.html')
        self.page.locator('.carnet-retirer').click()
        self.page.evaluate("""() => {
            window.originalSetItem = Storage.prototype.setItem;
            Storage.prototype.setItem = () => {throw new DOMException('Refus','QuotaExceededError')};
        }""")
        self.page.locator('#carnet-annuler').click()
        expect(self.page.locator('.carnet-fiche')).to_have_count(0)
        expect(self.page.locator('#carnet-annuler')).to_be_visible()
        expect(self.page.locator('#carnet-stockage')).to_contain_text("pas pu enregistrer")
        self.page.evaluate('() => { Storage.prototype.setItem = window.originalSetItem; }')
        self.page.locator('#carnet-annuler').click()
        expect(self.page.locator('.carnet-fiche')).to_have_count(1)
        self.page.reload()
        expect(self.page.locator('.carnet-fiche')).to_have_count(1)


if __name__ == '__main__':
    unittest.main(verbosity=2)
