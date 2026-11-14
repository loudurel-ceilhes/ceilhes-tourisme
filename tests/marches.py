"""Marchés pendant le séjour : interactions, dates, rechargement et repli sans JS."""
import datetime
import unittest
from urllib.parse import parse_qs, urlsplit
from playwright.sync_api import expect
import parcours

class Marches(unittest.TestCase):
    setUpClass = classmethod(parcours.Parcours.setUpClass.__func__)
    stop_server = classmethod(parcours.Parcours.stop_server.__func__)
    setUp = parcours.Parcours.setUp
    tearDown = parcours.Parcours.tearDown
    go = parcours.Parcours.go

    def choisir(self, debut, fin, commune=''):
        self.page.locator('#marches-debut').fill(debut)
        self.page.locator('#marches-fin').fill(fin)
        self.page.locator('#marches-commune').select_option(commune)
        self.page.locator('#marches-sejour button[type=submit]').click()

    def test_resultats_rechargeables_et_parametres_voisins_conserves(self):
        self.go('terroir.html?q=miel&campagne=ete#marches-du-pays')
        self.choisir('2026-11-14','2026-11-16','Bédarieux')
        expect(self.page.locator('.marche-resultat')).to_have_count(2)
        expect(self.page.locator('.marche-date').first).to_contain_text('samedi 14 novembre 2026')
        self.assertEqual(parse_qs(urlsplit(self.page.url).query),{
            'q':['miel'],'campagne':['ete'],'marche-debut':['2026-11-14'],
            'marche-fin':['2026-11-16'],'marche-commune':['Bédarieux']})
        self.page.reload(wait_until='load')
        expect(self.page.locator('.marche-resultat')).to_have_count(2)
        expect(self.page.locator('#marches-commune')).to_have_value('Bédarieux')
        self.assertTrue(self.page.locator('.marche-resultat a').first.get_attribute('href').startswith('https://www.bedarieux.fr/'))
        self.assertEqual(self.page.evaluate('document.documentElement.scrollWidth'),390)

    def test_erreurs_aucun_resultat_et_saison_non_reconduite(self):
        self.go('terroir.html#marches-du-pays')
        self.choisir('2026-11-14','2026-12-15')
        expect(self.page.locator('#marches-statut')).to_have_attribute('role','alert')
        expect(self.page.locator('#marches-statut')).to_contain_text('31 jours')
        expect(self.page.locator('.marche-resultat')).to_have_count(0)
        self.choisir('2026-11-15','2026-11-14')
        expect(self.page.locator('#marches-statut')).to_contain_text('fin du séjour')
        self.choisir('2026-11-14','2026-11-16','Avène')
        expect(self.page.locator('#marches-statut')).to_contain_text('Aucun rendez-vous datable')
        self.choisir('2027-07-01','2027-07-31','Ceilhes-et-Rocozels')
        expect(self.page.locator('.marche-resultat')).to_have_count(0)
        expect(self.page.locator('[data-marche-etat="marche-ceilhes-et-rocozels-21"]')).to_contain_text('Saison 2026 terminée')

    def test_initialisation_en_date_de_paris(self):
        self.page.clock.set_fixed_time(datetime.datetime(2026,11,14,23,30,tzinfo=datetime.timezone.utc))
        self.go('terroir.html#marches-du-pays')
        expect(self.page.locator('#marches-debut')).to_have_value('2026-11-15')
        expect(self.page.locator('#marches-fin')).to_have_value('2026-11-21')
        self.choisir('2027-01-01','2027-01-07','Bédarieux')
        self.page.locator('#marches-semaine').click()
        expect(self.page.locator('#marches-debut')).to_have_value('2026-11-15')
        expect(self.page.locator('#marches-commune')).to_have_value('')

    def test_sans_javascript_tous_les_marches_et_sources_restent_lisibles(self):
        context=self.browser.new_context(java_script_enabled=False,viewport={'width':390,'height':667})
        try:
            page=context.new_page();page.goto(self.base+'terroir.html')
            expect(page.locator('[data-marche-etat]')).to_have_count(32)
            expect(page.locator('#marches-sejour')).to_be_hidden()
            expect(page.locator('#marche-lacaune-19')).to_contain_text('3e samedi')
            expect(page.locator('#marche-ceilhes-et-rocozels-21')).to_contain_text('Saison 2026 terminée')
            expect(page.locator('#marche-avene-31')).to_contain_text('saison 2025')
            expect(page.locator('#marche-bedarieux-1 a')).to_have_count(2)
        finally: context.close()

if __name__=='__main__': unittest.main()
