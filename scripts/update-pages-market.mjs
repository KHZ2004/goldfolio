import {readFileSync,writeFileSync} from 'node:fs';
import {normalizeHargaQuote,normalizeHargaHistory} from '../hargaemas.mjs';
import {positive} from '../lib.mjs';
const file=new URL('../docs/market.json',import.meta.url);
let old={history:[]};try{old=JSON.parse(readFileSync(file,'utf8'));}catch{}
// Scheduled deployments reuse only public market data from the prior deployment.
if(process.env.PAGES_MARKET_URL)try{const r=await fetch(process.env.PAGES_MARKET_URL,{signal:AbortSignal.timeout(15000)});if(r.ok)old=await r.json();}catch{}
async function get(url){let err;for(let i=0;i<3;i++){try{const r=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Price feed HTTP '+r.status);return await r.json();}catch(e){err=e;await new Promise(r=>setTimeout(r,1000));}}throw err;}
let quote;for(const url of ['https://api.hargaemas.my/prices','https://www.hargaemas.my/api/gold-prices.json'])try{const q=normalizeHargaQuote(await get(url));if(!quote||Date.parse(q.updatedAt)>Date.parse(quote.updatedAt))quote=q;if(!q.isStale)break;}catch{}
if(!quote)throw Error('HargaEmas prices unavailable; keeping the previous published deployment.');
const history=(old.history||[]).filter(p=>positive(p.price)&&Number.isFinite(Date.parse(p.time))&&Date.parse(p.time)>Date.now()-366*86400000);
if(!history.some(x=>x.time===quote.updatedAt))history.push({time:quote.updatedAt,price:quote.price});
history.sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));
let historical=old.historical||null,historyError=null;
try{historical={sourceId:quote.sourceId,points:normalizeHargaHistory(await get('https://www.hargaemas.my/api/gold-prices-graph.json')),updatedAt:new Date().toISOString(),source:'HargaEmas.my chart - daily RM/g reference'};}catch{historyError='Historical feed unavailable. Showing last published history.';}
writeFileSync(file,JSON.stringify({quote,history,historical,historyError,error:null,publishedAt:new Date().toISOString()}));
console.log('Published market snapshot: '+quote.updatedAt);
