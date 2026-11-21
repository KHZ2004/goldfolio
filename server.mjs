import http from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import webpush from 'web-push';
import { reached, positive } from './lib.mjs';
import { HARGA_SOURCE, normalizeHargaQuote, normalizeHargaHistory } from './hargaemas.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const dir = process.env.DATA_DIR || path.join(root, 'data');
mkdirSync(dir, {recursive:true});
const file = path.join(dir, 'store.json');
const db = existsSync(file) ? JSON.parse(readFileSync(file)) : {devices:{}, history:[], quote:null};
// Discard incompatible market caches; purchase and alert records are preserved.
if(db.quote?.sourceId!==HARGA_SOURCE){db.quote=null;db.history=[];}
if(db.historical?.sourceId!==HARGA_SOURCE)db.historical=null;
const keyfile = path.join(dir,'vapid.json');
const keys = existsSync(keyfile) ? JSON.parse(readFileSync(keyfile)) : webpush.generateVAPIDKeys();
if (!existsSync(keyfile)) writeFileSync(keyfile, JSON.stringify(keys), {mode:0o600});
webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:goldfolio@example.com',keys.publicKey,keys.privateKey);
function save(){writeFileSync(file+'.tmp',JSON.stringify(db));renameSync(file+'.tmp',file);}
let busy = false, lastError = null;
let historyError=null;
async function refreshHistory(){
 try{
  if(db.historical?.updatedAt && Date.now()-Date.parse(db.historical.updatedAt)<6*3600000)return;
  const data=await getJSON('https://www.hargaemas.my/api/gold-prices-graph.json');
  db.historical={sourceId:HARGA_SOURCE,points:normalizeHargaHistory(data),updatedAt:new Date().toISOString(),source:'HargaEmas.my chart - daily reference prices in RM per gram'};
  historyError=null;save();
 }catch(e){historyError='Historical prices unavailable: '+e.message;console.error(historyError);}
}
async function getJSON(url){
 for(let attempt=0;attempt<2;attempt++){
  let r;
  try{r=await fetch(url,{signal:AbortSignal.timeout(15000)});}catch(e){if(attempt)throw e;await new Promise(resolve=>setTimeout(resolve,1000));continue;}
  if(r.ok)return r.json();
  if(r.status>=500&&!attempt){await new Promise(resolve=>setTimeout(resolve,1000));continue;}
  throw Error(`Price provider returned ${r.status}`);
 }
}
async function deliver(device, alert){
  if(!device.subscription)return;
  try {await webpush.sendNotification(device.subscription,JSON.stringify({title:'Gold price target reached',body:`Gold sell reference is RM ${alert.actual.toFixed(2)}/g. Your ${alert.direction === 'above' ? 'at or above' : 'at or below'} RM ${alert.target.toFixed(2)} target was reached.`,tag:alert.id}),{TTL:3600});alert.deliveredAt=new Date().toISOString();}
  catch(e){if(e.statusCode===410||e.statusCode===404)device.subscription=null;console.error('Push delivery failed:',e.statusCode || e.message);}
}
async function poll(){
 if(busy)return;busy=true;
 try {
  let quote;
  try{quote=normalizeHargaQuote(await getJSON('https://api.hargaemas.my/prices'));}catch(e){console.error('HargaEmas primary:',e.message);}
  if(!quote||quote.isStale){
   try{const proxy=normalizeHargaQuote(await getJSON('https://www.hargaemas.my/api/gold-prices.json'));if(!quote||(!proxy.isStale&&quote.isStale)||Date.parse(proxy.updatedAt)>Date.parse(quote.updatedAt))quote=proxy;}catch(e){if(!quote)throw e;}
  }
  db.quote=quote;lastError=null;
  if(!db.history.length||db.history.at(-1).time!==quote.updatedAt)db.history.push({time:quote.updatedAt,price:quote.price});
  db.history=db.history.filter(x=>Date.parse(x.time)>Date.now()-366*86400000);
  const fresh=!quote.isStale && Date.now()-Date.parse(quote.updatedAt)<15*60000;
  if(fresh) for(const device of Object.values(db.devices))for(const a of device.alerts){
   if(!a.triggeredAt&&reached(a,quote.price)){a.triggeredAt=new Date().toISOString();a.actual=quote.price;save();}
   if(a.triggeredAt&&!a.deliveredAt&&Date.now()-Date.parse(a.triggeredAt)<3600000)await deliver(device,a);
  }
  save();
 }catch(e){lastError=e.message;console.error('Price refresh:',e.message);}finally{busy=false;}
}
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer(async(req,res)=>{
 try {
 const url=new URL(req.url,'http://localhost');
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
 if(url.pathname.startsWith('/api/')){
  if(req.headers.origin && req.headers.origin !== `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`)return send(res,403,{error:'Origin rejected'});
  if(url.pathname==='/api/market'&&req.method==='GET')return send(res,200,{quote:db.quote,history:db.history,historical:db.historical||null,historyError,error:lastError,publicKey:keys.publicKey});
  const id=req.headers['x-device-id'];
  if(typeof id!=='string'||! /^[a-f0-9-]{36}$/.test(id))return send(res,401,{error:'Device key required'});
  const device=db.devices[id] ||= {lots:[],alerts:[],subscription:null};
  if(req.method==='GET'&&url.pathname==='/api/portfolio')return send(res,200,{lots:device.lots,alerts:device.alerts,subscribed:!!device.subscription});
  if(!['POST','PATCH','DELETE'].includes(req.method))return send(res,405,{error:'Method not allowed'});
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>20000)return send(res,413,{error:'Request too large'});}
  const body=raw?JSON.parse(raw):{};
  if(url.pathname==='/api/lots'&&req.method==='POST'){
   if(!positive(body.grams)||!positive(body.totalCost))return send(res,400,{error:'Enter valid grams and total paid in RM'});
   device.lots.push({id:randomUUID(),grams:body.grams,totalCost:body.totalCost,note:String(body.note||'').slice(0,120)});
  }else if(req.method==='PATCH'&&/^\/api\/lots\/[a-f0-9-]+$/.test(url.pathname)){
   const lot=device.lots.find(x=>x.id===url.pathname.split('/').at(-1));
   if(!lot)return send(res,404,{error:'Purchase not found. Refresh your portfolio and try again.'});
   if(!positive(body.grams)||!positive(body.totalCost))return send(res,400,{error:'Enter valid grams and total paid in RM'});
   lot.grams=body.grams;lot.totalCost=body.totalCost;lot.note=String(body.note||'').slice(0,120);
   delete lot.buyPrice;
  }else if(url.pathname==='/api/alerts'&&req.method==='POST'){
   if(!positive(body.target)||!['above','below'].includes(body.direction))return send(res,400,{error:'Enter a valid price target'});
   if(device.alerts.length>=100)return send(res,400,{error:'Maximum 100 alerts'});
   device.alerts.push({id:randomUUID(),target:body.target,direction:body.direction,createdAt:new Date().toISOString()});
  }else if(url.pathname==='/api/subscription'&&req.method==='POST'){
   const endpoint=new URL(body.endpoint);const h=endpoint.hostname;
   if(endpoint.protocol!=='https:' || !(h==='fcm.googleapis.com'||h==='updates.push.services.mozilla.com'||h.endsWith('.push.apple.com')||h==='web.push.apple.com'||h.endsWith('.notify.windows.com'))||typeof body.keys?.p256dh!=='string'||typeof body.keys?.auth!=='string')return send(res,400,{error:'Unsupported push subscription'});
   device.subscription=body;
  }else if(url.pathname==='/api/test-push'&&req.method==='POST'){
   if(!device.subscription)return send(res,400,{error:'Enable notifications first'});
   await webpush.sendNotification(device.subscription,JSON.stringify({title:'Goldfolio is connected',body:'Price alerts can now reach this phone.',tag:'test'}));
  }else if(req.method==='DELETE'&&/^\/api\/(lots|alerts)\/[a-f0-9-]+$/.test(url.pathname)){
   const [, ,type,key]=url.pathname.split('/');device[type]=device[type].filter(x=>x.id!==key);
  }else return send(res,404,{error:'Not found'});
  save();return send(res,200,{ok:true});
 }
 if(!['GET','HEAD'].includes(req.method))return send(res,405,{error:'Method not allowed'});
 const allowed=['/','/index.html','/app.js','/styles.css','/sw.js','/manifest.webmanifest','/icon.svg','/icon-192.png','/icon-512.png','/lib.mjs'];
 if(!allowed.includes(url.pathname))return send(res,404,{error:'Not found'});
 const p=url.pathname==='/'?'/index.html':url.pathname;
 const data=readFileSync(p==='/lib.mjs'?path.join(root,'lib.mjs'):path.join(root,'public',p));
 res.writeHead(200,{'Content-Type':mime[path.extname(p)] || 'text/javascript','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:data);
 }catch(e){send(res,e.code==='ENOENT'?404:400,{error:e.code==='ENOENT'?'Not found':e.message});}
});
const port=Number(process.env.PORT||3000);server.listen(port,'0.0.0.0',()=>console.log(`Goldfolio: http://localhost:${server.address().port}`));
poll();setInterval(poll,120000);
refreshHistory();setInterval(refreshHistory,15*60000);
