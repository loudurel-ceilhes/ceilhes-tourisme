"""Préparer un courriel sans l'envoyer, y compris sans JS et sur mobile."""
import json
import subprocess
import unittest
from urllib.parse import parse_qs, urlencode, urlsplit
from playwright.sync_api import expect
import parcours


class Contributions(unittest.TestCase):
    setUpClass = classmethod(parcours.Parcours.setUpClass.__func__)
    stop_server = classmethod(parcours.Parcours.stop_server.__func__)
    setUp = parcours.Parcours.setUp
    tearDown = parcours.Parcours.tearDown
    go = parcours.Parcours.go

    def test_correction_preparee_sans_photo_ni_envoi(self):
        writes=[]
        self.page.on('request',lambda request: writes.append(request.url) if request.method!='GET' else None)
        self.go('contribuer.html?'+urlencode({'fiche':'/terroir.html#gaec-de-la-source-de-l-orb','type':'correction'}))
        self.page.locator('#contribution-correction').fill('Le nouvel horaire est 10 h. Essai local, ne pas envoyer.')
        self.page.get_by_role('button',name='Préparer le message').click()
        expect(self.page.locator('#contribution-apercu')).to_be_visible()
        expect(self.page.locator('#contribution-statut')).to_contain_text('Rien n’a été envoyé')
        href=self.page.locator('#contribution-courriel').get_attribute('href')
        query=parse_qs(urlsplit(href).query)
        self.assertIn('GAEC de la Source',query['body'][0])
        self.assertIn('10 h',query['body'][0])
        self.assertNotIn('Autorisation',query['body'][0])
        self.assertEqual(urlsplit(href).path,'lou.durel@gmail.com')
        self.assertEqual(writes,[])
        self.page.locator('#contribution-correction').fill('Autre horaire')
        expect(self.page.locator('#contribution-apercu')).to_be_hidden()

    def test_photo_autorisation_et_piece_jointe_mobile(self):
        self.page.set_viewport_size({'width':390,'height':844})
        self.go('contribuer.html?type=photo')
        self.page.locator('#contribution-legende').fill('Le Bouloc. Essai local.')
        self.page.locator('#contribution-credit').fill('Photo © Auteur de test')
        self.page.locator('#contribution-piece-jointe').check()
        self.page.get_by_role('button',name='Préparer le message').click()
        expect(self.page.locator('#contribution-apercu')).to_be_hidden()
        self.page.locator('#contribution-autorisation').check()
        self.page.locator('#contribution-personnes').check()
        self.page.get_by_role('button',name='Préparer le message').click()
        expect(self.page.locator('#contribution-message')).to_have_value(__import__('re').compile('joindrai la photo'))
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
        self.page.locator('#contribution-type-correction').check()
        expect(self.page.locator('#contribution-apercu')).to_be_hidden()
        expect(self.page.locator('#contribution-credit')).to_be_disabled()

    def test_url_forgee_et_html_restant_du_texte(self):
        self.go('contribuer.html?'+urlencode({'fiche':'https://evil.example/','type':'photo'}))
        expect(self.page.locator('#contribution-fiche')).to_have_value('https://ceilhes-tourisme.fr/')
        expect(self.page.locator('#contribution-statut')).to_contain_text('n’est pas reconnu')
        self.page.locator('#contribution-type-correction').check()
        self.page.locator('#contribution-correction').fill('<img src=x onerror=alert(1)>')
        self.page.get_by_role('button',name='Préparer le message').click()
        expect(self.page.locator('#contribution-message')).to_have_value(__import__('re').compile('<img src=x'))
        self.assertEqual(self.page.locator('#contribution-apercu img').count(),0)

    def test_fiches_patrimoine_et_associations_contextuelles(self):
        self.go('patrimoine.html')
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        self.page.set_viewport_size({'width':320,'height':740})
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        monuments=self.page.locator('.monuments li')
        self.assertEqual(monuments.count(),32)
        expect(monuments.locator('.contribution-liens')).to_have_count(32)
        monument=monuments.first
        anchor=monument.get_attribute('id')
        title=monument.locator('b').first.inner_text()
        self.assertEqual(anchor,'monument-pa00103465')
        expect(self.page.locator('#monument-statues-menhirs-murat-sur-vebre .contribution-liens')).to_have_count(1)
        monument.get_by_role('link',name='Corriger cette fiche',exact=True).click()
        expect(self.page.locator('#contribution-fiche')).to_have_value('https://ceilhes-tourisme.fr/patrimoine.html#'+anchor)
        expect(self.page.locator('#contribution-contexte')).to_contain_text(title)
        self.go('vie-associative.html')
        associations=self.page.locator('.asso')
        expect(associations.locator('.contribution-liens')).to_have_count(6)
        association=associations.first
        anchor=association.get_attribute('id')
        title=association.locator('h4').inner_text()
        association.get_by_role('link',name='Proposer une photo',exact=True).click()
        expect(self.page.locator('#contribution-type-photo')).to_be_checked()
        expect(self.page.locator('#contribution-fiche')).to_have_value('https://ceilhes-tourisme.fr/vie-associative.html#'+anchor)
        expect(self.page.locator('#contribution-contexte')).to_contain_text(title)

    def test_liens_generes_et_solution_sans_javascript(self):
        code="import {enrichirPage} from './scripts/contributions.mjs'; console.log(enrichirPage('<html><head></head><body><h1>Lieu</h1><article id=\"maison\"><h2>Maison test</h2></article><footer></footer></body></html>','terroir.html').html);"
        body=subprocess.check_output(['node','--input-type=module','-e',code],cwd=parcours.ROOT,text=True)
        context=self.browser.new_context(java_script_enabled=False,viewport={'width':390,'height':844})
        try:
            page=context.new_page()
            page.route('**/terroir.html',lambda route:route.fulfill(status=200,content_type='text/html',body=body))
            page.goto(self.base+'terroir.html')
            expect(page.locator('article').get_by_role('link',name='Proposer une photo')).to_be_visible()
            page.goto(self.base+'contribuer.html')
            expect(page.locator('#contribution-form')).to_be_hidden()
            expect(page.get_by_role('link',name='lou.durel@gmail.com',exact=True)).to_be_visible()
            self.assertTrue(page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
        finally:context.close()


if __name__=='__main__':unittest.main()
