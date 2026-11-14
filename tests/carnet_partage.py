"""Transfert explicite du carnet : IDs publics, fusion sûre et copie autonome."""
import json
from pathlib import Path
import unittest
from urllib.parse import urlsplit
from playwright.sync_api import expect
import parcours

KEY = 'ceilhes:mon-sejour:v1'
BOULOC = 'rando-balade-bouloc'
ORB = 'rando-balade-orb'


class CarnetPartage(unittest.TestCase):
    setUpClass = classmethod(parcours.Parcours.setUpClass.__func__)
    stop_server = classmethod(parcours.Parcours.stop_server.__func__)
    setUp = parcours.Parcours.setUp
    tearDown = parcours.Parcours.tearDown
    def go(self, path=''):
        response = self.page.goto(self.base + path, wait_until='load')
        if response is not None:
            self.assertEqual(response.status, 200)


    def add_bouloc(self):
        self.go('randonnees.html')
        self.page.locator('#balade-bouloc .carnet-ajouter').click()
        self.go('mon-sejour.html')

    def import_file(self, data):
        self.page.locator('#carnet-fichier').set_input_files({
            'name': 'carnet.json', 'mimeType': 'application/json',
            'buffer': json.dumps(data).encode(),
        })

    def test_partage_seulement_ids_et_fusion_explicite_sans_doublons(self):
        self.add_bouloc()
        self.page.locator('#carnet-partager').click()
        share = self.page.locator('#carnet-lien').input_value()
        self.assertEqual(share, 'https://ceilhes-tourisme.fr/mon-sejour.html#carnet=' + BOULOC)
        self.go('mon-sejour.html#carnet=' + BOULOC + ',' + ORB + ',ancienne-idee,' + ORB)
        expect(self.page.locator('.carnet-fiche')).to_have_count(1)
        expect(self.page.locator('#carnet-apercu-liste li')).to_have_count(2)
        expect(self.page.locator('#carnet-apercu-resume')).to_contain_text('ancienne ou inconnue')
        expect(self.page.locator('#carnet-apercu-resume')).to_contain_text('déjà présente')
        self.page.locator('#carnet-importer').click()
        expect(self.page.locator('.carnet-fiche')).to_have_count(2)
        self.assertEqual(urlsplit(self.page.url).fragment, '')
        self.page.reload()
        expect(self.page.locator('.carnet-fiche')).to_have_count(2)

    def test_annuler_et_fichier_invalide_ne_changent_rien(self):
        self.add_bouloc()
        self.import_file({'format': 'ceilhes-mon-sejour', 'version': 2, 'ids': [ORB]})
        expect(self.page.locator('#carnet-apercu')).to_be_visible()
        self.page.locator('#carnet-import-annuler').click()
        expect(self.page.locator('.carnet-fiche')).to_have_count(1)
        for ids in [['<img src=x onerror=alert(1)>'], ['a'] * 61, [], 'rando']:
            self.import_file({'format': 'ceilhes-mon-sejour', 'version': 2, 'ids': ids})
            expect(self.page.locator('#carnet-import-retour')).to_contain_text('reste inchangée')
            expect(self.page.locator('.carnet-fiche')).to_have_count(1)
            expect(self.page.locator('#carnet-apercu')).not_to_be_visible()
        self.go('mon-sejour.html#carnet=%3Cimg%3E')
        expect(self.page.locator('#carnet-import-retour')).to_contain_text('invalide')
        expect(self.page.locator('.carnet-fiche')).to_have_count(1)

    def test_export_import_et_page_hors_ligne_sans_requete(self):
        self.add_bouloc()
        with self.page.expect_download() as download_info:
            self.page.locator('#carnet-exporter').click()
        exported = json.loads(Path(download_info.value.path()).read_text())
        self.assertEqual(exported, {'format': 'ceilhes-mon-sejour', 'version': 2, 'ids': [BOULOC]})
        self.page.locator('.carnet-retirer').click()
        self.import_file(exported)
        expect(self.page.locator('.carnet-fiche')).to_have_count(0)
        self.page.locator('#carnet-importer').click()
        expect(self.page.locator('.carnet-fiche')).to_have_count(1)
        with self.page.expect_download() as download_info:
            self.page.locator('#carnet-hors-ligne').click()
        downloaded = Path(download_info.value.path()).read_text()
        self.assertNotIn('<script', downloaded)
        self.assertIn('14 novembre 2026', downloaded)
        ctx = self.browser.new_context(offline=True)
        try:
            page = ctx.new_page()
            requests = []
            page.on('request', lambda request: requests.append(request.url))
            # Le navigateur géré bloque file:// ; charger exactement le fichier
            # téléchargé dans un contexte hors réseau vérifie son autonomie.
            page.set_content(downloaded)
            expect(page.locator('h1')).to_have_text('Mon séjour à Ceilhes')
            expect(page.locator('li')).to_have_count(1)
            expect(page.locator('body')).to_contain_text('sans connexion')
            self.assertFalse(any(url.startswith('http') for url in requests))
        finally:
            ctx.close()

    def test_refus_stockage_conserve_apercu_et_selection(self):
        self.add_bouloc()
        self.go('mon-sejour.html#carnet=' + ORB)
        self.page.evaluate("() => { Storage.prototype.setItem = () => {throw new DOMException('Refus','QuotaExceededError')}; }")
        self.page.locator('#carnet-importer').click()
        expect(self.page.locator('.carnet-fiche')).to_have_count(1)
        expect(self.page.locator('#carnet-stockage')).to_contain_text('pas pu enregistrer')
        expect(self.page.locator('#carnet-apercu')).to_be_visible()
        expect(self.page.locator('#carnet-importer')).to_be_enabled()

    def test_limite_60_et_catalogue_inconnu_sans_perte(self):
        self.go('mon-sejour.html')
        source = self.page.locator('#carnet-catalogue').text_content()
        catalog = json.loads(source)['items']
        retained = [x for x in catalog if x['id'] != ORB][:60]
        self.page.evaluate('([key,items])=>localStorage.setItem(key,JSON.stringify({version:1,items}))', [KEY, retained])
        self.page.reload()
        self.go('mon-sejour.html#carnet=' + ORB)
        expect(self.page.locator('#carnet-importer')).to_be_disabled()
        expect(self.page.locator('#carnet-apercu-resume')).to_contain_text('limite est de 60')
        expect(self.page.locator('.carnet-fiche')).to_have_count(60)
        self.page.locator('.carnet-retirer').first.click()
        expect(self.page.locator('#carnet-importer')).to_be_enabled()
        self.page.locator('#carnet-importer').click()
        expect(self.page.locator('.carnet-fiche')).to_have_count(60)
        self.go('mon-sejour.html#carnet=ancienne-idee')
        expect(self.page.locator('#carnet-importer')).to_be_disabled()
        expect(self.page.locator('#carnet-apercu-resume')).to_contain_text('0 idée reconnue')

    def test_etape_de_guide_partagee_resolue_depuis_catalogue(self):
        self.go('mon-sejour.html')
        catalog = json.loads(self.page.locator('#carnet-catalogue').text_content())['items']
        guide = next(item for item in catalog if item['category'] == 'Guide')
        self.go('mon-sejour.html#carnet=' + guide['id'])
        expect(self.page.locator('#carnet-apercu-liste')).to_contain_text(guide['title'])
        expect(self.page.locator('.carnet-fiche')).to_have_count(0)
        self.page.locator('#carnet-importer').click()
        expect(self.page.locator('.carnet-fiche .carnet-categorie')).to_have_text('Guide')
        expect(self.page.locator('.carnet-fiche a')).to_have_attribute('href', guide['url'])
        self.page.reload()
        expect(self.page.locator('.carnet-fiche h2')).to_have_text(guide['title'])

    def test_mobile_et_echec_copie_avec_repli(self):
        self.add_bouloc()
        self.page.locator('#carnet-partager').click()
        self.page.evaluate("Object.defineProperty(navigator, 'clipboard', {value: {writeText:async()=>{throw new Error('Refus')}}})")
        self.page.locator('#carnet-copier').click()
        expect(self.page.locator('#carnet-partage-retour')).to_contain_text('Copiez le lien sélectionné')
        expect(self.page.locator('#carnet-lien')).to_be_focused()
        for width in [320, 390, 1200]:
            self.page.set_viewport_size({'width': width, 'height': 800})
            self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
        self.page.emulate_media(media='print')
        expect(self.page.locator('.carnet-transfert').first).not_to_be_visible()


if __name__ == '__main__':
    unittest.main(verbosity=2)
