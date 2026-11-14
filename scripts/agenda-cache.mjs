// Construction reproductible : aucune requête réseau, sources datées du dernier rafraîchissement.
import { actualiserAgenda } from './agenda.mjs'
await actualiserAgenda({cacheOnly:true})
