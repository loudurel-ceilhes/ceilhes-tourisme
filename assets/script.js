const REDUCE=matchMedia('(prefers-reduced-motion: reduce)').matches;
// ----- Nav -----
const nav=document.getElementById('nav');
if(nav){
  addEventListener('scroll',()=>nav.classList.toggle('scrolled',scrollY>60),{passive:true});
  const burger=document.getElementById('burger'),menu=document.getElementById('menu');
  if(burger&&menu){
    const mobile=matchMedia('(max-width:1024px)');
    let restoreBackground=()=>{};
    function setMenu(open,returnFocus=false){
      open=open&&mobile.matches;
      restoreBackground();
      restoreBackground=()=>{};
      menu.classList.toggle('open',open);
      burger.classList.toggle('open',open);
      burger.setAttribute('aria-expanded',String(open));
      burger.setAttribute('aria-label',open?'Fermer le menu':'Ouvrir le menu');
      document.body.classList.toggle('menu-open',open);
      menu.inert=mobile.matches&&!open;
      if(open){
        const background=[...document.body.children].filter(el=>el!==nav&&!['SCRIPT','STYLE'].includes(el.tagName));
        const previous=background.map(el=>el.inert);
        background.forEach(el=>{el.inert=true;});
        restoreBackground=()=>background.forEach((el,i)=>{el.inert=previous[i];});
        menu.querySelector('a')?.focus();
      }else if(returnFocus){burger.focus();}
    }
    burger.addEventListener('click',()=>setMenu(!menu.classList.contains('open')));
    menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>setMenu(false)));
    nav.addEventListener('keydown',e=>{
      if(!menu.classList.contains('open'))return;
      if(e.key==='Escape'){e.preventDefault();setMenu(false,true);}
      if(e.key==='Tab'){
        const links=[burger,...menu.querySelectorAll('a[href]')];
        const first=links[0],last=links[links.length-1];
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      }
    });
    mobile.addEventListener('change',()=>{
      const menuHadFocus=menu.contains(document.activeElement);
      setMenu(false,mobile.matches&&menuHadFocus);
    });
    nav.classList.add('nav-ready');
    setMenu(false);
  }
}
// ----- Parallaxe hero -----
const layers=document.querySelectorAll('.hero .layer');
if(layers.length&&!REDUCE)addEventListener('scroll',()=>{const y=scrollY;if(y<innerHeight)layers.forEach(l=>l.style.transform=`translateY(${y*l.dataset.speed*0.5}px)`);},{passive:true});
// ----- Reveal au scroll -----
// Le contenu reste visible par défaut, même si JavaScript échoue. On anime
// seulement son arrivée, sans jamais conditionner la lecture à l'observateur.
if('IntersectionObserver' in window&&!REDUCE){
  const io=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting){
    e.target.classList.add('visible');
    e.target.animate([{transform:'translateY(18px)'},{transform:'translateY(0)'}],{duration:500,easing:'ease-out'});
    io.unobserve(e.target);
  }});},{threshold:.12});
  document.querySelectorAll('.reveal,.gal-grid figure').forEach(el=>io.observe(el));
}
// ----- Compteurs animes -----
if('IntersectionObserver' in window&&!REDUCE){
  const ioNum=new IntersectionObserver(es=>{es.forEach(e=>{if(!e.isIntersecting)return;const el=e.target,target=+el.dataset.count,dur=1000,t0=performance.now();(function tick(t){const p=Math.min((t-t0)/dur,1),ease=1-Math.pow(1-p,3);el.textContent=Math.round(target*ease);if(p<1)requestAnimationFrame(tick);})(t0);ioNum.unobserve(el);});},{threshold:.6});
  document.querySelectorAll('[data-count]').forEach(el=>ioNum.observe(el));
}
// ----- Progression & retour haut -----
const prog=document.getElementById('progress'),totop=document.getElementById('totop');
addEventListener('scroll',()=>{const h=document.documentElement.scrollHeight-innerHeight;if(prog)prog.style.width=(h>0?(scrollY/h)*100:0)+'%';if(totop)totop.classList.toggle('show',scrollY>innerHeight*0.8);},{passive:true});
if(totop)totop.addEventListener('click',()=>scrollTo({top:0,behavior:REDUCE?'instant':'smooth'}));
// ----- Cascade -----
document.querySelectorAll('.act-grid,.prod-grid,.lake-cards,.around-grid,.dir-grid,.infos-grid,.gal-grid,.hub-grid,.trail-grid,.species-grid,.factstrip,.stats .container').forEach(g=>{[...g.children].forEach((el,i)=>{el.style.transitionDelay=(i%6)*0.09+'s';el.addEventListener('transitionend',()=>{el.style.transitionDelay='0s';},{once:true});});});
// ----- Tilt 3D -----
if(matchMedia('(hover:hover)').matches&&!REDUCE){document.querySelectorAll('.act-card,.prod-card,a.dir-card,.lake-card,.hub-card,.trail-card').forEach(card=>{card.classList.add('tilt');card.addEventListener('mousemove',e=>{const r=card.getBoundingClientRect();const x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;card.style.transform=`perspective(800px) rotateY(${x*6}deg) rotateX(${-y*6}deg) translateY(-6px)`;});card.addEventListener('mouseleave',()=>{card.style.transform='';});});}
// ----- Galerie & lightbox -----
const grid=document.getElementById('galGrid'),lb=document.getElementById('lightbox');
if(grid&&lb&&typeof lb.showModal==='function'){
  const lbImg=lb.querySelector('img'),lbCap=lb.querySelector('.cap');
  let figs=[],idx=0,trigger=null,previousOverflow='';
  grid.querySelectorAll('figure img').forEach(img=>{img.addEventListener('error',()=>{img.closest('figure').style.display='none';refreshFigs();});});
  function refreshFigs(){figs=[...grid.querySelectorAll('figure')].filter(f=>f.style.display!=='none');}
  refreshFigs();
  grid.addEventListener('click',e=>{
    const link=e.target.closest('a.gal-photo');
    if(!link||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button!==0)return;
    e.preventDefault();trigger=link;refreshFigs();idx=figs.indexOf(link.closest('figure'));show();
  });
  function show(){
    if(!figs.length)return;
    const f=figs[idx],im=f.querySelector('img');
    lbImg.src=f.querySelector('a.gal-photo').href;
    lbImg.alt=im.alt;
    lbCap.textContent=`${idx+1} / ${figs.length} — ${f.querySelector('figcaption').textContent}`;
    if(!lb.open){previousOverflow=document.body.style.overflow;lb.showModal();}
    document.body.style.overflow='hidden';
  }
  function closeLb(){lb.close();}
  lb.addEventListener('close',()=>{document.body.style.overflow=previousOverflow;trigger?.focus();});
  lb.querySelector('.close').addEventListener('click',closeLb);
  lb.addEventListener('click',e=>{if(e.target===lb)closeLb();});
  lb.querySelector('.prev').addEventListener('click',()=>{idx=(idx-1+figs.length)%figs.length;show();});
  lb.querySelector('.next').addEventListener('click',()=>{idx=(idx+1)%figs.length;show();});
  lb.addEventListener('keydown',e=>{
    if(e.key==='ArrowLeft'){e.preventDefault();idx=(idx-1+figs.length)%figs.length;show();}
    if(e.key==='ArrowRight'){e.preventDefault();idx=(idx+1)%figs.length;show();}
    if(e.key==='Tab'){
      const buttons=[...lb.querySelectorAll('button')],first=buttons[0],last=buttons[buttons.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  });
}
// ----- L'Orb : flow au scroll -----
const course=document.getElementById('course'),flow=document.getElementById('flow');
if(course&&flow){addEventListener('scroll',()=>{const r=course.getBoundingClientRect();const p=Math.min(Math.max((innerHeight*0.75-r.top)/r.height,0),1);flow.style.height=(p*100)+'%';},{passive:true});}
// ----- Parallaxe banniere -----
const banner=document.getElementById('banner'),bImg=banner?banner.querySelector('img'):null;
if(bImg&&!REDUCE){addEventListener('scroll',()=>{const r=banner.getBoundingClientRect();if(r.bottom>0&&r.top<innerHeight)bImg.style.transform=`translateY(${(r.top/innerHeight)*-40}px)`;},{passive:true});}
// ----- Filtres des sentiers et de l'annuaire pratique -----
function initFilter(selector,cardSelector,key){
  const group=document.querySelector(selector);
  if(!group)return;
  const buttons=[...group.querySelectorAll('button')];
  const cards=[...document.querySelectorAll(cardSelector)];
  const status=document.createElement('p');
  status.className='filter-status';status.setAttribute('role','status');
  group.after(status);
  function select(button){
    const value=button.dataset[key];
    buttons.forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});
    cards.forEach(card=>{card.hidden=value!=='tous'&&!(card.dataset[key]||'').split(/\s+/).includes(value);});
    const count=cards.filter(card=>!card.hidden).length;
    status.textContent=`${count} résultat${count>1?'s':''}`;
  }
  buttons.forEach(b=>b.addEventListener('click',()=>select(b)));
  select(buttons.find(b=>b.classList.contains('active'))||buttons[0]);
  group.classList.add('filters-ready');
}
initFilter('.filter-chips','.trail-card','lv');
initFilter('.cat-chips','.dir-card','cat');
// ----- Onglets accessibles, contenus tous lisibles sans JavaScript -----
function initTabs(selector,panelSelector,key){
  document.querySelectorAll(selector).forEach((group,groupIndex)=>{
    const tabs=[...group.querySelectorAll('button')];
    const panels=[...group.closest('section').querySelectorAll(panelSelector)];
    const prefix=`onglet-${key}-${groupIndex}`;
    function activate(index,focus=false){
      tabs.forEach((tab,i)=>{
        const selected=i===index;
        tab.classList.toggle('active',selected);tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;
        const panel=panels.find(p=>p.dataset[key]===tab.dataset[key]);
        if(panel){panel.hidden=!selected;panel.classList.toggle('active',selected);}
      });
      if(focus)tabs[index].focus();
    }
    group.setAttribute('role','tablist');
    group.setAttribute('aria-label',key==='hab'?'Habitats':'Saisons');
    tabs.forEach((tab,i)=>{
      const panel=panels.find(p=>p.dataset[key]===tab.dataset[key]);
      if(!panel)return;
      tab.id=`${prefix}-${i}`;tab.setAttribute('role','tab');
      panel.id=`${prefix}-panneau-${i}`;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',tab.id);panel.tabIndex=0;
      tab.setAttribute('aria-controls',panel.id);
      tab.addEventListener('click',()=>activate(i));
      tab.addEventListener('keydown',e=>{
        let next;
        if(e.key==='ArrowRight')next=(i+1)%tabs.length;
        if(e.key==='ArrowLeft')next=(i-1+tabs.length)%tabs.length;
        if(e.key==='Home')next=0;
        if(e.key==='End')next=tabs.length-1;
        if(next!==undefined){e.preventDefault();activate(next,true);}
      });
    });
    activate(Math.max(0,tabs.findIndex(t=>t.classList.contains('active'))));
    group.classList.add('tabs-ready');
  });
}
initTabs('.hab-tabs','.hab-panel','hab');
initTabs('.season-tabs','.season-panel','s');
// ----- Carte Leaflet multi-calques (page Alentours) -----
if(window.L && document.getElementById('map')){
  const map=L.map('map',{scrollWheelZoom:false}).setView([43.78,3.17],11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:18}).addTo(map);
  map.on('click',()=>map.scrollWheelZoom.enable());
  function pin(color){return L.divIcon({className:'',html:'<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:'+color+';transform:rotate(-45deg);border:2.5px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,.4)"></div>',iconSize:[22,22],iconAnchor:[11,22],popupAnchor:[0,-22]});}
  const V='#1b3a2f',E='#2e7d8c',A='#c98f4e';
  const gVillage=L.layerGroup(),gEau=L.layerGroup(),gAutour=L.layerGroup();
  const pts=[
    [43.813,3.095,V,gVillage,'<b>Ceilhes-et-Rocozels</b><br>Le village — point de départ de votre séjour'],
    [43.8115,3.0975,A,gVillage,'<b>L\'Esquirol</b><br>Épicerie locavore, bar & terrasse d\'été<br>2 bis avenue du Lac'],
    [43.8105,3.092,A,gVillage,'<b>Le Village des Sources ***</b><br>Camping, chalets & piscine à 500 m du lac'],
    [43.808,3.089,E,gEau,'<b>Plan d\'eau du Bouloc</b><br>Baignade, pêche, jeux, pique-nique'],
    [43.775,3.095,E,gEau,'<b>Lac des Monts d\'Orb</b><br>(lac d\'Avène) — 6 km de rives boisées'],
    [43.756,3.103,A,gAutour,'<b>Avène</b><br>Station thermale'],
    [43.711,3.193,A,gAutour,'<b>Lunas</b><br>Base de loisirs de la Prade'],
    [43.736,3.165,A,gAutour,'<b>Joncels</b><br>Abbaye bénédictine (VIII<sup>e</sup> s.)'],
    [43.787,3.249,A,gAutour,'<b>Lerab Ling</b><br>Temple bouddhiste (Roqueredonde)'],
    [43.732,3.319,A,gAutour,'<b>Lodève</b><br>Ville d\'art et d\'histoire'],
    [43.651,3.385,E,gAutour,'<b>Lac du Salagou</b><br>Terres rouges & cirque de Mourèze']
  ];
  pts.forEach(([lat,lng,c,g,html])=>L.marker([lat,lng],{icon:pin(c)}).bindPopup(html).addTo(g));
  L.polyline([[43.813,3.095],[43.775,3.11],[43.736,3.165],[43.711,3.193],[43.70,3.27],[43.651,3.385]],{color:'#c98f4e',weight:3,dashArray:'8 8',opacity:.8}).bindPopup('<b>Sentier des 2 Lacs</b><br>GR® de Pays Avène – Salagou (tracé indicatif)').addTo(gAutour);
  gVillage.addTo(map);gEau.addTo(map);gAutour.addTo(map);
  L.control.layers(null,{'🏘️ Village & commerces':gVillage,'💧 Lacs & baignade':gEau,'⛰️ À découvrir autour':gAutour},{collapsed:false}).addTo(map);
}
// ----- Parallaxe douce des fonds de subhero -----
const subbg=document.querySelector('.subhero .subbg');
if(subbg&&!REDUCE)addEventListener('scroll',()=>{if(scrollY<innerHeight)subbg.style.transform=`translateY(${scrollY*0.28}px)`;},{passive:true});

// ----- Héros : fondu lié au scroll -----
const heroC=document.querySelector('.hero .hero-content');
if(heroC&&!REDUCE)addEventListener('scroll',()=>{const y=scrollY,h=innerHeight;if(y<h){heroC.style.opacity=Math.max(1-y/(h*.55),0);heroC.style.transform=`translateY(${y*.16}px)`;}},{passive:true});
