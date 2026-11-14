import { createHash } from 'node:crypto'
import { dateValide, ajouterJours } from '../assets/agenda-calendrier.js'
export const SOURCE_CENOMES='https://esquirols.fr/assets/data/ardoise-cenomes.json'
const PAGE='https://esquirols.fr/cenomes.html'
const digest=data=>createHash('sha256').update(JSON.stringify(data)).digest('hex')
export function validerArdoise(data) {
  if (data?.version!==1 || data.timezone!=='Europe/Paris' || !dateValide(data.updated) || !Array.isArray(data.menus) || !Array.isArray(data.events) || !Array.isArray(data.recurringEvents ?? [])) throw new Error('Ardoise Cénomes invalide')
  const itemValid=x=>['midi','soir'].includes(x.service)&&typeof x.title==='string'&&x.title.length>0&&x.title.length<=200&&Array.isArray(x.dishes)&&x.dishes.every(d=>typeof d==='string'&&d.length<=500)&&(x.priceEur===null||(Number.isFinite(x.priceEur)&&x.priceEur>0))
  for (const x of [...data.menus,...data.events]) if (!dateValide(x.date)||!itemValid(x)) throw new Error('Date ou contenu de l’ardoise invalide')
  for (const x of data.recurringEvents??[]) if (!/^[a-z0-9-]+$/.test(x.id)||!['first','last'].includes(x.rule)||!Number.isInteger(x.weekday)||x.weekday<0||x.weekday>6||!dateValide(x.startsOn)||(x.endsOn&&!dateValide(x.endsOn))||!itemValid(x)||!Array.isArray(x.excludedDates??[])||!(x.excludedDates??[]).every(dateValide)) throw new Error('Récurrence Cénomes invalide')
  return data
}
export function instantaneCenomes(data, receivedOn) {
  validerArdoise(data)
  if (!dateValide(receivedOn)) throw new Error('Date de réception invalide')
  return {source:SOURCE_CENOMES,receivedOn,sha256:digest(data),data}
}
export function evenementsCenomes(snapshot, today, days=90) {
  if (!snapshot || snapshot.source!==SOURCE_CENOMES || snapshot.sha256!==digest(snapshot.data) || !dateValide(snapshot.receivedOn)) throw new Error('Provenance de l’ardoise invalide')
  const data=validerArdoise(snapshot.data),end=ajouterJours(today,days)
  const occupied=new Set([...data.events,...data.menus].map(x=>`${x.date}-${x.service}`))
  const events=data.events.filter(x=>x.service==='soir'&&x.date>=today&&x.date<=end)
  for (const series of data.recurringEvents??[]) {
    if (series.service!=='soir') continue
    for (let day=today;day<=end;day=ajouterJours(day,1)) {
      const date=new Date(`${day}T00:00:00Z`),monthLast=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate()
      const goodRank=series.rule==='first'?date.getUTCDate()<=7:date.getUTCDate()>monthLast-7
      if (day<series.startsOn||(series.endsOn&&day>series.endsOn)||date.getUTCDay()!==series.weekday||!goodRank||series.excludedDates?.includes(day)||occupied.has(`${day}-${series.service}`)) continue
      occupied.add(`${day}-${series.service}`);events.push({...series,date:day})
    }
  }
  return events.sort((a,b)=>a.date.localeCompare(b.date)).map(item=>{
    const sourceUri=`${PAGE}?date=${item.date}&service=soir#rendez-vous-${item.date}-soir`
    return {nom:item.title,periodes:[{debut:item.date,fin:item.date}],debut:item.date,fin:item.date,enCours:false,dateTri:item.date,
      description:[...item.dishes,`Au restaurant L’Esquirol Cénomes, le soir. ${item.priceEur===null?'Horaire précis et tarif à demander':`Tarif annoncé : ${new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(item.priceEur)} TTC. Horaire précis à demander`} au 05 65 99 35 19. Réservation selon les disponibilités.`].join('\n'),
      adresse:'L’Esquirol Cénomes · 197 route du Bourg',contacts:'05 65 99 35 19',sourceUri,sourceKind:'cenomes',
      commune:'Cénomes / Montagnol',codePostal:'12360',identifiant:'12360#Montagnol',createur:'L’Esquirol Cénomes',maj:data.updated,receivedOn:snapshot.receivedOn,
      bookingUrl:sourceUri,activity:'🍽️ Gourmand',service:'soir',priceEur:item.priceEur}
  })
}
