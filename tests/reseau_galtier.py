"""Recherche de producteurs : parcours local, aucun appel externe."""
import json, os, socket, subprocess, tempfile, time, unittest, urllib.request
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect
ROOT = Path(__file__).resolve().parents[1]

class ReseauGaltier(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0)); port = sock.getsockname()[1]
        cls.base = f'http://127.0.0.1:{port}/'
        cls.log = tempfile.TemporaryFile()
        cls.server = subprocess.Popen([os.environ.get('CEILHES_NODE','node'), 'scripts/serve.mjs'],cwd=ROOT,env={**os.environ,'PORT':str(port)},stdout=cls.log,stderr=cls.log)
        def stop():
            cls.server.terminate()
            try: cls.server.wait(timeout=5)
            except subprocess.TimeoutExpired: cls.server.kill(); cls.server.wait()
            cls.log.close()
        cls.addClassCleanup(stop)
        for _ in range(100):
            try:
                urllib.request.urlopen(cls.base,timeout=1).close(); break
            except OSError: time.sleep(.05)
        else: raise RuntimeError('Le serveur ne répond pas')
        cls.pw=sync_playwright().start(); cls.addClassCleanup(cls.pw.stop)
        exe=os.environ.get('BROWSER_EXECUTABLE')
        cls.browser=cls.pw.chromium.launch(headless=True,**({'executable_path':exe} if exe else {})); cls.addClassCleanup(cls.browser.close)
        cls.total=len(json.loads((ROOT/'data/reseau-producteurs.json').read_text())['producteurs'])

    def setUp(self):
        self.context=self.browser.new_context(viewport={'width':390,'height':844})
        self.context.route('**/*',lambda route: route.continue_() if urlsplit(route.request.url).hostname=='127.0.0.1' else route.abort())
        self.page=self.context.new_page(); self.errors=[]
        self.page.on('pageerror',lambda error:self.errors.append(str(error)))
        self.addCleanup(self.context.close)

    def tearDown(self): self.assertEqual(self.errors,[])

    def test_recherche_accents_filtres_partage_et_reset(self):
        self.page.goto(self.base+'producteurs-region.html')
        expect(self.page.locator('.reseau-fiche:visible')).to_have_count(self.total)
        self.page.locator('#reseau-recherche').fill('roucadel')
        expect(self.page.locator('.reseau-fiche:visible')).to_have_count(1)
        expect(self.page.locator('#producteur-65')).to_be_visible()
        self.page.reload()
        expect(self.page.locator('.reseau-fiche:visible')).to_have_count(1)
        self.page.get_by_role('button',name='Tout afficher').click()
        expect(self.page.locator('.reseau-fiche:visible')).to_have_count(self.total)
        self.page.locator('#reseau-statut').select_option('fiche')
        self.assertGreater(self.page.locator('.reseau-fiche:visible').count(),0)
        self.page.locator('#reseau-recherche').fill('aucune-fiche-impossible')
        expect(self.page.locator('#reseau-vide')).to_be_visible()
        self.page.get_by_role('button',name='Tout afficher').click()
        self.page.locator('#reseau-recherche').fill('lozere')
        self.assertGreater(self.page.locator('.reseau-fiche:visible').count(),0)
        self.assertLess(self.page.locator('.reseau-fiche:visible').count(),self.total)
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),390)

    def test_sans_javascript_et_parametres_inconnus(self):
        self.page.goto(self.base+'producteurs-region.html?cat=inconnue&dep=999&statut=stock-disponible')
        expect(self.page.locator('.reseau-fiche:visible')).to_have_count(self.total)
        ctx=self.browser.new_context(java_script_enabled=False,viewport={'width':390,'height':844})
        self.addCleanup(ctx.close)
        page=ctx.new_page(); page.goto(self.base+'producteurs-region.html')
        expect(page.locator('.reseau-fiche:visible')).to_have_count(self.total)
        expect(page.locator('#reseau-filtres')).to_be_hidden()
        expect(page.locator('#producteur-65 h2')).to_contain_text('ROUCADEL')
