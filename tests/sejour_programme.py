"""Dates communes, journées, transfert ancien/nouveau et recherche locale."""
import json
import unittest
from pathlib import Path
from playwright.sync_api import expect
import parcours

KEY = 'ceilhes:mon-sejour:v1'
DATES = 'ceilhes:dates-sejour:v1'
BOULOC = 'rando-balade-bouloc'
ORB = 'rando-balade-orb'


class Programme(unittest.TestCase):
    setUpClass = classmethod(parcours.Parcours.setUpClass.__func__)
    stop_server = classmethod(parcours.Parcours.stop_server.__func__)
    setUp = parcours.Parcours.setUp
    tearDown = parcours.Parcours.tearDown
    def go(self, path=''):
        response = self.page.goto(self.base + path, wait_until='load')
        if response is not None:
            self.assertEqual(response.status, 200)

    def add(self):
        self.go('mon-sejour.html#carnet=' + BOULOC)
        self.page.locator('#carnet-importer').click()

    def dates(self, start='2026-12-18', end='2026-12-20'):
        self.page.locator('#carnet-debut').fill(start)
        self.page.locator('#carnet-fin').fill(end)
        self.page.locator('#carnet-dates-form button[type=submit]').click()

    def test_dates_communes_marches_et_retour_sans_effacer_les_idees(self):
        self.add()
        self.dates()
        self.page.locator('#carnet-marches-dates').click()
        expect(self.page.locator('#marches-debut')).to_have_value('2026-12-18')
        expect(self.page.locator('#marches-fin')).to_have_value('2026-12-20')
        self.page.locator('#marches-debut').fill('2026-12-21')
        self.page.locator('#marches-fin').fill('2026-12-23')
        self.page.locator('#marches-sejour button[type=submit]').click()
        self.page.reload()
        expect(self.page.locator('#marches-debut')).to_have_value('2026-12-21')
        self.go('mon-sejour.html')
        expect(self.page.locator('#carnet-debut')).to_have_value('2026-12-21')
        expect(self.page.locator('.carnet-fiche')).to_have_count(1)
        self.page.locator('#carnet-dates-effacer').click()
        expect(self.page.locator('#carnet-debut')).to_have_value('')
        expect(self.page.locator('.carnet-fiche')).to_have_count(1)

    def test_journee_partage_export_et_ancien_import_conservent_programme(self):
        self.add()
        self.dates()
        self.page.locator('.carnet-affectation input').fill('2026-12-19')
        expect(self.page.locator('.carnet-jour-titre')).to_contain_text('19 décembre 2026')
        self.page.locator('#carnet-partager').click()
        share = self.page.locator('#carnet-lien').input_value()
        self.assertIn('&sejour=2026-12-18,2026-12-20', share)
        self.assertIn('&jours=' + BOULOC + ':2026-12-19', share)
        with self.page.expect_download() as info:
            self.page.locator('#carnet-exporter').click()
        data = json.loads(Path(info.value.path()).read_text())
        self.assertEqual(data['days'], {BOULOC: '2026-12-19'})
        self.assertEqual(data['stay']['start'], '2026-12-18')
        # Un ancien fichier ne peut effacer le programme actuel.
        self.page.locator('#carnet-fichier').set_input_files({'name': 'ancien.json', 'mimeType': 'application/json', 'buffer': json.dumps({'format': 'ceilhes-mon-sejour', 'version': 2, 'ids': [BOULOC, ORB]}).encode()})
        self.page.locator('#carnet-importer').click()
        expect(self.page.locator('[data-idea-id="' + BOULOC + '"] input')).to_have_value('2026-12-19')
        expect(self.page.locator('#carnet-debut')).to_have_value('2026-12-18')
        # Nouvelle ouverture du partage dans un navigateur sans sélection.
        self.page.evaluate('([items,dates])=>{localStorage.removeItem(items);localStorage.removeItem(dates)}', [KEY, DATES])
        self.page.goto('about:blank')
        self.go('mon-sejour.html#' + share.split('#', 1)[1])
        expect(self.page.locator('.carnet-fiche')).to_have_count(0)
        expect(self.page.locator('#carnet-debut')).to_have_value('')
        self.page.locator('#carnet-importer').click()
        expect(self.page.locator('.carnet-affectation input')).to_have_value('2026-12-19')
        expect(self.page.locator('#carnet-debut')).to_have_value('2026-12-18')

    def test_dates_invalides_stockage_refuse_et_jour_hors_sejour(self):
        self.add()
        self.dates()
        self.page.locator('.carnet-affectation input').fill('2026-12-25')
        expect(self.page.locator('.carnet-incompatibilite')).to_contain_text('en dehors')
        self.dates('2026-12-21', '2026-12-20')
        expect(self.page.locator('#carnet-dates-retour')).to_contain_text('31 jours maximum')
        self.page.evaluate("() => { Storage.prototype.setItem = () => {throw new Error('Refus')} }")
        self.dates('2026-12-21', '2026-12-23')
        expect(self.page.locator('#carnet-dates-retour')).to_contain_text('pas pu enregistrer')
        self.page.reload()
        expect(self.page.locator('#carnet-debut')).to_have_value('2026-12-18')
        expect(self.page.locator('.carnet-affectation input')).to_have_value('2026-12-25')

    def test_effacement_dates_propage_entre_onglets_sans_les_reenregistrer(self):
        self.add()
        self.dates()
        other = self.context.new_page()
        try:
            other.clock.set_fixed_time(__import__('datetime').datetime(2026, 11, 14, 12, tzinfo=__import__('datetime').timezone.utc))
            other.goto(self.base + 'terroir.html?debut=2026-12-18&fin=2026-12-20#marches-du-pays')
            expect(other.locator('#marches-debut')).to_have_value('2026-12-18')
            self.dates('2026-12-21', '2026-12-23')
            expect(other.locator('#marches-debut')).to_have_value('2026-12-21')
            other.reload()
            expect(other.locator('#marches-debut')).to_have_value('2026-12-21')
            self.page.locator('#carnet-dates-effacer').click()
            expect(other.locator('#marches-debut')).to_have_value('2026-11-14')
            self.assertIsNone(other.evaluate('SejourDates.read()'))
            self.assertNotIn('2026-12-18', other.url)
            other.reload()
            self.assertIsNone(other.evaluate('SejourDates.read()'))
        finally:
            other.close()

    def test_evenement_date_incompatible_et_copie_hors_ligne(self):
        self.go('mon-sejour.html')
        data = json.loads(self.page.locator('#carnet-catalogue').text_content())
        item = next(i for i in data['items'] if i.get('dates') and len(i['dates']) == 1)
        self.go('mon-sejour.html#carnet=' + item['id'])
        self.page.locator('#carnet-importer').click()
        self.page.locator('.carnet-affectation input').fill('2026-12-31')
        expect(self.page.locator('.carnet-incompatibilite')).to_contain_text('pas annoncé')
        with self.page.expect_download() as info:
            self.page.locator('#carnet-hors-ligne').click()
        content = Path(info.value.path()).read_text()
        self.assertIn('31 décembre 2026', content)
        self.assertIn('Dates annoncées', content)
        self.assertNotIn('<script', content)

    def test_recherche_synonymes_lien_rechargeable_et_mobile(self):
        self.go('recherche.html?q=bus')
        expect(self.page.locator('#recherche-resultats')).to_contain_text('Infos pratiques')
        for query, text in [('pharmacie', 'services essentiels'), ('toilettes', 'services essentiels'), ('raclette', 'raclette')]:
            self.page.locator('#recherche-q').fill(query)
            self.page.locator('#recherche-form button').click()
            expect(self.page.locator('#recherche-resultats')).to_contain_text(text)
        self.page.locator('#recherche-q').fill('miel')
        self.page.locator('#recherche-form button').click()
        expect(self.page.locator('#recherche-resultats')).to_contain_text('Miellerie')
        self.page.reload()
        expect(self.page.locator('#recherche-q')).to_have_value('miel')
        self.page.locator('#recherche-q').fill('<img src=x onerror=alert(1)>')
        self.page.locator('#recherche-form button').click()
        expect(self.page.locator('#recherche-statut')).to_contain_text('Aucun résultat')
        expect(self.page.locator('#recherche-resultats img')).to_have_count(0)
        for width in [320, 390, 1280]:
            self.page.set_viewport_size({'width': width, 'height': 800})
            self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= innerWidth'))


if __name__ == '__main__':
    unittest.main()
