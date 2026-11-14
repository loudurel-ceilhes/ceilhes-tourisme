"""Parcours locaux : python3 tests/parcours.py (module Playwright requis)."""
import datetime
import html
import json
import os
import re
from pathlib import Path
import socket
import subprocess
import tempfile
import time
import unittest
import urllib.request
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]


class Parcours(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        cls.base = f'http://127.0.0.1:{port}/'
        cls.log = tempfile.TemporaryFile()
        cls.server = subprocess.Popen(
            [os.environ.get('CEILHES_NODE', 'node'), 'scripts/serve.mjs'], cwd=ROOT,
            env={**os.environ, 'PORT': str(port)}, stdout=cls.log, stderr=cls.log)
        cls.addClassCleanup(cls.stop_server)
        for _ in range(100):
            try:
                with urllib.request.urlopen(cls.base, timeout=1) as response:
                    assert response.status == 200
                break
            except OSError:
                if cls.server.poll() is not None:
                    raise RuntimeError('Le serveur local ne démarre pas')
                time.sleep(.05)
        else:
            raise RuntimeError('Le serveur local ne répond pas')
        cls.playwright = sync_playwright().start()
        cls.addClassCleanup(cls.playwright.stop)
        executable = os.environ.get('BROWSER_EXECUTABLE')
        cls.browser = cls.playwright.chromium.launch(
            headless=True, **({'executable_path': executable} if executable else {}))
        cls.addClassCleanup(cls.browser.close)

    @classmethod
    def stop_server(cls):
        cls.server.terminate()
        try:
            cls.server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            cls.server.kill()
            cls.server.wait()
        cls.log.close()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 390, 'height': 667})
        self.context.route('**/*', lambda route: route.continue_()
                           if urlsplit(route.request.url).hostname == '127.0.0.1'
                           else route.abort())
        self.page = self.context.new_page()
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        # Les filtres temporels sont testés un samedi connu, indépendamment du jour de CI.
        self.page.clock.set_fixed_time(datetime.datetime(2026, 11, 14, 12, tzinfo=datetime.timezone.utc))

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [], 'Erreur JavaScript pendant le parcours')

    def go(self, path=''):
        response = self.page.goto(self.base + path, wait_until='load')
        self.assertEqual(response.status, 200)

    def test_toutes_les_pages_et_ressources(self):
        for path in sorted(ROOT.glob('*.html')):
            with self.subTest(page=path.name):
                self.go(path.name)
                expect(self.page.locator('h1')).to_have_count(1)
                expect(self.page.locator('main')).to_have_count(1)
                self.assertTrue(self.page.title())
                expect(self.page.locator('.skip')).to_have_attribute('href', '#contenu')
        self.assertEqual(self.page.request.get(self.base+'page-inexistante-test.html').status, 404)

    def test_menu_clavier_mobile_et_redimensionnement(self):
        self.go()
        menu = self.page.locator('#menu')
        burger = self.page.locator('#burger')
        expect(burger).to_have_attribute('aria-expanded', 'false')
        self.assertTrue(menu.evaluate('(e)=>e.inert'))
        self.page.keyboard.press('Tab')
        expect(self.page.locator('.skip')).to_be_focused()
        self.page.keyboard.press('Enter')
        expect(self.page.locator('main')).to_be_focused()
        burger.focus()
        self.page.keyboard.press('Enter')
        expect(burger).to_have_attribute('aria-expanded', 'true')
        expect(menu.locator('a').first).to_be_focused()
        self.assertTrue(self.page.locator('main').evaluate('(e)=>e.inert'))
        menu.locator('a').last.focus()
        self.page.keyboard.press('Tab')
        expect(burger).to_be_focused()
        self.page.keyboard.press('Shift+Tab')
        expect(menu.locator('a').last).to_be_focused()
        self.page.keyboard.press('Escape')
        expect(burger).to_be_focused()
        self.assertFalse(self.page.locator('main').evaluate('(e)=>e.inert'))
        self.page.set_viewport_size({'width':1280,'height':900})
        expect(menu.locator('a').first).to_be_visible()
        self.assertFalse(menu.evaluate('(e)=>e.inert'))
        self.page.set_viewport_size({'width':390,'height':667})
        expect(menu).to_have_attribute('inert', '')

    def test_galerie_au_clavier(self):
        for path in ['galerie.html', 'infos-pratiques.html']:
            self.go(path)
            first = self.page.locator('.gal-photo').first
            first.focus()
            self.page.keyboard.press('Enter')
            dialog = self.page.locator('#lightbox')
            expect(dialog).to_be_visible()
            expect(dialog.locator('.close')).to_be_focused()
            initial_src = dialog.locator('img').get_attribute('src')
            self.assertTrue(dialog.locator('img').get_attribute('alt'))
            self.page.keyboard.press('ArrowRight')
            expect(dialog.locator('img')).not_to_have_attribute('src', initial_src)
            for _ in range(5):
                self.page.keyboard.press('Tab')
                self.assertTrue(dialog.evaluate('(e)=>e.contains(document.activeElement)'))
            self.page.keyboard.press('Escape')
            expect(dialog).not_to_be_visible()
            expect(first).to_be_focused()
            # Toucher le bas de la vignette, sous la légende, ouvre aussi la photo.
            first.scroll_into_view_if_needed()
            box = first.bounding_box()
            self.page.mouse.click(box['x']+box['width']/2, box['y']+box['height']-20)
            expect(dialog).to_be_visible()
            self.page.keyboard.press('Escape')

    def test_annuaire_recherche_filtres_et_carte_indisponible(self):
        self.go('terroir.html')
        cards = self.page.locator('#annuaire-producteurs .prod-card')
        total = cards.count()
        self.assertGreater(total, 0)
        search = self.page.locator('#recherche-producteurs')
        expect(search).to_be_visible()
        search.fill('roquefort')
        results = self.page.locator('#annuaire-producteurs .prod-card:not([hidden])')
        self.assertGreater(results.count(), 0)
        self.assertLess(results.count(), total)
        self.assertTrue(results.evaluate_all('(es)=>es.every(e=>e.textContent.toLowerCase().includes("roquefort"))'))
        search.fill('aucun-producteur-xyz-inexistant')
        expect(results).to_have_count(0)
        expect(self.page.locator('#aucun-producteur')).to_be_visible()
        self.page.locator('#filtres-producteurs [type=reset]').click()
        expect(results).to_have_count(total)
        self.page.locator('#produit-producteurs').select_option('miel')
        self.assertGreater(results.count(), 0)
        self.assertTrue(results.evaluate_all('(es)=>es.every(e=>e.dataset.produits.split(" ").includes("miel"))'))
        # Une panne des cartes externes ne gêne pas les résultats locaux.
        expect(self.page.locator('#etat-carte-producteurs')).to_contain_text('carte')

    def test_agenda_commune_activite_weekend_et_reset(self):
        # Données contrôlées : la mise à jour quotidienne du vrai agenda ne doit
        # pas faire échouer un test à cause d'un week-end simplement sans sortie.
        fixtures = [
            ('Concert samedi', 'Avène', 'Concert', '2026-11-14', '2026-11-14'),
            ('Marché dimanche', 'Ceilhes-et-Rocozels', 'Marché', '2026-11-15', '2026-11-15'),
            ('Exposition en cours', 'Avène', 'Exposition', '2026-11-01', '2026-11-30'),
            ('Concert lundi', 'Lodève', 'Concert', '2026-11-16', '2026-11-16'),
            ('Marché terminé', 'Lodève', 'Marché', '2026-11-07', '2026-11-07'),
        ]
        cards_html = []
        for name, town, activity, start, end in fixtures:
            dates = html.escape(json.dumps([{'debut':start,'fin':end}]), quote=True)
            cards_html.append(f'<article class="ev-card" data-periodes="{dates}" data-commune="{town}" data-activite="{activity}"><div class="ev-body"><span class="ev-lieu">{town}</span><span class="ev-tag">{activity}</span><h3>{name}</h3></div></article>')
        cards_html.append('<article class="ev-card"><div class="ev-body"><span class="ev-lieu">Camarès</span><span class="ev-tag">Exposition</span><h3>Exposition ancienne à confirmer</h3></div></article>')
        cards_html.append('<script type="application/ld+json">'+json.dumps({'@graph':[{'@type':'Event','name':'Exposition ancienne à confirmer','startDate':'2026-11-13','location':{'address':{'addressLocality':'Camarès'}}}]})+'</script>')
        body = re.sub(r'<!-- @agenda -->.*?<!-- @/agenda -->', lambda _: '<!-- @agenda --><div class="agenda-list">'+''.join(cards_html)+'</div><!-- @/agenda -->', (ROOT/'agenda.html').read_text(), flags=re.S)
        self.page.route('**/agenda.html', lambda route: route.fulfill(status=200, content_type='text/html', body=body))
        self.go('agenda.html')
        cards = self.page.locator('#agenda-list .ev-card:not([hidden])')
        total = cards.count()
        self.assertEqual(total, 6)
        commune = self.page.locator('#agenda-commune')
        commune.select_option('Avène')
        expect(cards).to_have_count(2)
        self.page.locator('#agenda-activite').select_option('Concert')
        expect(cards).to_have_count(1)
        expect(cards.locator('h3')).to_have_text('Concert samedi')
        self.page.locator('#agenda-activite').select_option('Marché')
        expect(cards).to_have_count(0)
        expect(self.page.locator('#agenda-aucun')).to_be_visible()
        self.page.locator('#agenda-filtres [type=reset]').click()
        expect(cards).to_have_count(total)
        self.page.locator('#agenda-periode').select_option('weekend')
        expect(self.page.locator('#agenda-weekend-detail')).to_contain_text('14 novembre 2026')
        expect(cards).to_have_count(4)
        expect(cards.locator('h3')).to_have_text(['Concert samedi','Marché dimanche','Exposition en cours','Exposition ancienne à confirmer'])
        expect(self.page.locator('.agenda-date-incertaine:visible')).to_have_count(1)
        self.page.locator('#agenda-filtres [type=reset]').click()
        expect(cards).to_have_count(total)
        expect(self.page.locator('.agenda-date-incertaine:visible')).to_have_count(0)

    def test_onglets_et_filtres_existants(self):
        self.go('nature.html')
        tabs = self.page.locator('.hab-tabs [role=tab]')
        tabs.first.focus()
        self.page.keyboard.press('ArrowRight')
        expect(tabs.nth(1)).to_be_focused()
        expect(tabs.nth(1)).to_have_attribute('aria-selected', 'true')
        expect(self.page.locator('.hab-panel:not([hidden])')).to_have_count(1)
        self.go('randonnees.html')
        button = self.page.locator('.filter-chips [data-lv=facile]')
        button.click()
        expect(button).to_have_attribute('aria-pressed', 'true')
        self.assertTrue(self.page.locator('.trail-card:not([hidden])').evaluate_all('(es)=>es.length>0&&es.every(e=>e.dataset.lv==="facile")'))

    def test_sans_javascript_et_si_script_indisponible(self):
        nojs = self.browser.new_context(java_script_enabled=False, viewport={'width':390,'height':667})
        try:
            nojs.route('**/*', lambda route: route.continue_() if urlsplit(route.request.url).hostname=='127.0.0.1' else route.abort())
            page = nojs.new_page()
            page.goto(self.base)
            self.assertTrue(page.locator('.reveal').evaluate_all('(es)=>es.every(e=>getComputedStyle(e).opacity==="1")'))
            expect(page.locator('#menu a').first).to_be_visible()
            expect(page.locator('#preparer-sejour')).to_be_visible()
            self.assertTrue(page.locator('[data-count]').evaluate_all('(es)=>es.every(e=>e.textContent===e.dataset.count)'))
            page.goto(self.base+'terroir.html')
            expect(page.locator('#filtres-producteurs')).not_to_be_visible()
            self.assertGreater(page.locator('.prod-card:visible').count(), 0)
            page.goto(self.base+'nature.html')
            expect(page.locator('.hab-panel:visible')).to_have_count(4)
            expect(page.locator('.season-panel:visible')).to_have_count(4)
            page.goto(self.base+'galerie.html')
            link = page.locator('.gal-photo').first.get_attribute('href')
            self.assertEqual(page.request.get(self.base+link).status, 200)
        finally:
            nojs.close()
        self.page.route('**/assets/script.js*', lambda route: route.abort())
        self.go()
        self.assertTrue(self.page.locator('.reveal').evaluate_all('(es)=>es.every(e=>getComputedStyle(e).opacity==="1")'))
        expect(self.page.locator('#menu a').first).to_be_visible()

    def test_accueil_mobile_et_reduction_mouvements(self):
        self.page.emulate_media(reduced_motion='reduce')
        self.go()
        expect(self.page.locator('.hero-content .cta a').first).to_have_text('Préparer mon séjour')
        self.assertEqual(self.page.locator('.hero-photo').evaluate('(e)=>getComputedStyle(e).animationDuration.split(",")[0]'), '1e-05s')
        for width in [320, 390]:
            self.page.set_viewport_size({'width':width,'height':667})
            for path in ['', 'terroir.html', 'agenda.html', 'randonnees.html', 'le-lac.html', 'l-orb.html', 'infos-pratiques.html', 'hebergeurs.html']:
                self.go(path)
                self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth'), f'{path} à {width}px')
        self.page.set_viewport_size({'width':1440,'height':1000})
        self.go()
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth'))

    def test_acces_restauration_marches_et_hebergements(self):
        self.go()
        self.page.locator('.sejour-acces a[href="infos-pratiques.html#manger"]').click()
        expect(self.page.locator('#manger')).to_be_in_viewport()
        expect(self.page.locator('#manger a[href="tel:+33782037166"]')).to_have_count(1)
        self.go('hebergeurs.html')
        self.page.locator('.page-reperes a[href="#autres"]').click()
        expect(self.page.locator('#autres')).to_be_in_viewport()
        self.assertEqual(self.page.locator('.hosts-contact a[href^="tel:"]').count(), 3)
        self.go('terroir.html')
        self.page.locator('.page-reperes a[href="#marches-du-pays"]').click()
        expect(self.page.locator('#marches-du-pays')).to_be_in_viewport()


if __name__ == '__main__':
    unittest.main(verbosity=2)
