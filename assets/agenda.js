import { dateValide, ajouterJours, periodesChoisies, ouvertureConnue } from './agenda-calendrier.js';
// Les cartes et leurs dates complètes restent lisibles sans JavaScript.
(() => {
  const form=document.getElementById('agenda-filtres');
  if (!form) return;
  const cards=[...document.querySelectorAll('#agenda-list .ev-card')];
  if (!cards.length) return;
  const period=document.getElementById('agenda-periode'),commune=document.getElementById('agenda-commune'),activity=document.getElementById('agenda-activite');
  const start=document.getElementById('agenda-debut'),end=document.getElementById('agenda-fin'),dateFields=document.getElementById('agenda-dates');
  const count=document.getElementById('agenda-compteur'),empty=document.getElementById('agenda-aucun'),detail=document.getElementById('agenda-weekend-detail');
  const status=document.getElementById('agenda-dates-statut'),more=document.getElementById('agenda-plus');
  const events=[];
  document.querySelectorAll('script[type="application/ld+json"]').forEach(script=>{
    try {events.push(...(JSON.parse(script.textContent)['@graph']||[]).filter(e=>e['@type']==='Event'));} catch {}
  });
  const data=cards.map(card=>{
    const event=events.find(e=>e.name===card.querySelector('h3')?.textContent);
    let dates=[],opening=null;
    try {dates=JSON.parse(card.dataset.periodes||'[]').filter(p=>dateValide(p.debut)&&dateValide(p.fin)&&p.debut<=p.fin);} catch {}
    const precise=dates.length>0;
    if (!dates.length&&dateValide(event?.startDate?.slice(0,10))) dates=[{debut:event.startDate.slice(0,10),fin:(event.endDate||event.startDate).slice(0,10)}];
    try {const o=JSON.parse(card.dataset.ouverture||'null');if(o&&dateValide(o.from)&&dateValide(o.through)&&Array.isArray(o.weekdays))opening=o;} catch {}
    const notice=document.createElement('p');notice.className='agenda-date-incertaine';notice.textContent='Dates à confirmer auprès de l’organisateur.';notice.hidden=true;
    card.querySelector('.ev-body').append(notice);
    const openingNotice=card.querySelector('.ev-ouverture');
    return {card,commune:card.dataset.commune||event?.location?.address?.addressLocality||card.querySelector('.ev-lieu')?.textContent||'Ceilhes-et-Rocozels',
      activity:card.dataset.activite||card.querySelector('.ev-tag')?.textContent||'Animation',dates,opening,
      uncertainEnd:!precise&&Boolean(event?.startDate)&&!event.endDate,notice,openingNotice,originalOpening:openingNotice?.textContent};
  });
  for (const [select,values] of [[commune,data.map(e=>e.commune)],[activity,data.map(e=>e.activity)]]) {
    [...new Set(values)].sort((a,b)=>a.localeCompare(b,'fr')).forEach(value=>{const option=document.createElement('option');option.value=value;option.textContent=value;select.append(option);});
  }
  const selection=[{name:'periode',select:period,fallback:'tous'},{name:'commune',select:commune,fallback:'toutes'},{name:'activite',select:activity,fallback:'toutes'}];
  const validRange=(a,b)=>dateValide(a)&&dateValide(b)&&a<=b&&Date.parse(b)-Date.parse(a)<=30*86400000;
  const format=new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
  const label=day=>format.format(new Date(day+'T00:00:00Z'));
  let saving=false,expanded=false;
  function readSelection() {
    const params=new URL(location.href).searchParams;
    for(const {name,select,fallback} of selection){const value=params.get(name);select.value=[...select.options].some(o=>o.value===value)?value:fallback;}
    const shared=window.SejourDates?.read();
    const range=validRange(params.get('debut'),params.get('fin'))?{start:params.get('debut'),end:params.get('fin')}:shared;
    if(range&&validRange(range.start,range.end)){start.value=range.start;end.value=range.end;if(!params.has('periode'))period.value='sejour';}
    else {start.value='';end.value='';}
  }
  function saveSelection() {
    const url=new URL(location.href);
    for(const {name,select,fallback} of selection){if(select.value!==fallback)url.searchParams.set(name,select.value);else url.searchParams.delete(name);}
    if(period.value==='sejour'&&validRange(start.value,end.value)){url.searchParams.set('debut',start.value);url.searchParams.set('fin',end.value);}
    else {url.searchParams.delete('debut');url.searchParams.delete('fin');}
    if(url.href!==location.href){try{history.replaceState(history.state,'',url);}catch{}}
  }
  function weekend() {
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));const today=`${p.year}-${p.month}-${p.day}`;
    const day=new Date(today+'T00:00:00Z').getUTCDay();const from=ajouterJours(today,day===0?-1:6-day);
    return {from,to:ajouterJours(from,1)};
  }
  function dateLine(p) {
    const li=document.createElement('li');li.className='ev-periode';
    const time=day=>{const t=document.createElement('time');t.dateTime=day;t.textContent=label(day);return t;};
    li.append(p.debut===p.fin?'Le ':'Du ',time(p.debut));if(p.debut!==p.fin)li.append(' au ',time(p.fin));return li;
  }
  function showDates(item,dates,filtered) {
    const container=item.card.querySelector('.ev-dates');if(!container)return;
    const ul=document.createElement('ul');ul.className='ev-periodes';ul.setAttribute('aria-label',filtered?'Dates correspondant à la période choisie':'Prochaines dates du rendez-vous');
    dates.slice(0,3).forEach(p=>ul.append(dateLine(p)));container.replaceChildren(ul);
    if(dates.length>3){const details=document.createElement('details');details.className='ev-autres-dates';const summary=document.createElement('summary');summary.textContent=`Voir les ${dates.length-3} autres dates${filtered?' de cette période':''}`;const rest=document.createElement('ul');rest.className='ev-periodes';dates.slice(3).forEach(p=>rest.append(dateLine(p)));details.append(summary,rest);container.append(details);}
    const first=dates[0];if(first){const d=new Date(first.debut+'T00:00:00Z');const badge=item.card.querySelector('.ev-date');if(badge){badge.querySelector('.d').textContent=d.getUTCDate();badge.querySelector('.m').textContent=new Intl.DateTimeFormat('fr-FR',{month:'long',timeZone:'UTC'}).format(d);}}
  }
  function filter() {
    dateFields.hidden=period.value!=='sejour';
    const custom=period.value==='sejour';const valid=validRange(start.value,end.value);
    const range=period.value==='weekend'?weekend():custom&&valid?{from:start.value,to:end.value}:null;
    status.textContent=custom&&!valid?'Choisissez un début et une fin valides, dans une période de 31 jours maximum. Tous les rendez-vous restent affichés en attendant.':'';
    if(custom&&valid&&window.SejourDates&&!saving){saving=true;const saved=window.SejourDates.write({start:start.value,end:end.value});saving=false;if(!saved)status.textContent='Les dates sont utilisées ici ; leur enregistrement dans ce navigateur est indisponible.';}
    let visible=0,matched=0,nearby=0,uncertain=0;
    const limited=!expanded&&!range&&commune.value==='toutes'&&activity.value==='toutes';
    data.forEach(item=>{
      let dates=item.dates;
      if(range) dates=periodesChoisies(item.uncertainEnd?item.dates.map(d=>({...d,fin:range.to})):item.dates,range.from,range.to,item.opening);
      const matches=(commune.value==='toutes'||item.commune===commune.value)&&(activity.value==='toutes'||item.activity===activity.value)&&(!range||dates.length>0);
      if(matches)matched++;
      const paged=matches&&limited&&item.card.dataset.agendaSource!=='cenomes'&&++nearby>12;
      item.card.hidden=!matches||paged;item.notice.hidden=!(matches&&!paged&&item.uncertainEnd&&range);if(!item.notice.hidden)uncertain++;
      if(matches&&!paged){visible++;showDates(item,dates,Boolean(range));}
      if(item.openingNotice){
        item.openingNotice.textContent=range&&!ouvertureConnue(item.opening,range.from,range.to)&&item.dates.some(p=>p.debut!==p.fin)
          ?'Manifestation en cours : ouverture pendant ces dates à vérifier auprès de l’organisateur.' : item.originalOpening;
      }
    });
    count.textContent=`${visible} rendez-vous affiché${visible>1?'s':''} sur ${cards.length}.${matched>visible?' Les autres rendez-vous sont accessibles avec le bouton ci-dessous ou en choisissant vos dates.':''}${uncertain?` Pour ${uncertain} d’entre eux, les dates restent à confirmer.`:''}`;
    more.hidden=matched<=visible;more.textContent=`Voir les ${matched-visible} autres rendez-vous`;
    empty.hidden=matched!==0;detail.hidden=!range;
    if(range)detail.textContent=`Du ${label(range.from)} au ${label(range.to)}. Les dates affichées correspondent à cette période ; les fermetures connues sont prises en compte. Vérifiez les horaires dans les détails.`;
    document.querySelectorAll('#agenda-list .agenda-list').forEach(list=>{
      const filtered=Boolean(range)||commune.value!=='toutes'||activity.value!=='toutes';const hide=filtered&&![...list.querySelectorAll('.ev-card')].some(c=>!c.hidden);list.hidden=hide;
      let previous=list.previousElementSibling;while(previous&&(previous.classList.contains('agenda-titre')||previous.classList.contains('agenda-sous-titre'))){previous.hidden=hide;previous=previous.previousElementSibling;}
    });
    saveSelection();
  }
  more.addEventListener('click',()=>{expanded=true;filter();});
  form.addEventListener('submit',e=>{e.preventDefault();filter();});form.addEventListener('change',filter);
  form.addEventListener('reset',e=>{e.preventDefault();expanded=false;period.value='tous';commune.value='toutes';activity.value='toutes';filter();});
  function revealLinkedEvent(){let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}const card=cards.find(c=>c.id===id);if(!card)return;if(card.hidden){expanded=true;period.value='tous';commune.value='toutes';activity.value='toutes';filter();}const details=card.querySelector('.ev-details');if(details)details.open=true;card.scrollIntoView({block:'start'});}
  addEventListener('sejour:dates-changed',()=>{if(saving)return;const range=window.SejourDates?.read();if(range&&validRange(range.start,range.end)){start.value=range.start;end.value=range.end;if(period.value==='sejour')filter();}else{start.value='';end.value='';if(period.value==='sejour')period.value='tous';filter();}});
  addEventListener('popstate',()=>{readSelection();filter();revealLinkedEvent();});addEventListener('hashchange',revealLinkedEvent);
  readSelection();filter();revealLinkedEvent();form.hidden=false;
  let currentWeekend=JSON.stringify(weekend());
  function refreshDay(){const next=JSON.stringify(weekend());if(next!==currentWeekend){currentWeekend=next;if(period.value==='weekend')filter();}}
  addEventListener('visibilitychange',()=>{if(!document.hidden)refreshDay();});setInterval(refreshDay,30000);
})();
