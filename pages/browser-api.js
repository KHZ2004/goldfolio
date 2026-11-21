import {positive,reached,purchaseCost} from './lib.mjs';
const KEY='goldfolio-pages-portfolio-v1';
let cached=null;
const database=new Promise((resolve,reject)=>{
 const request=indexedDB.open('goldfolio-portfolio',1);
 request.onupgradeneeded=()=>request.result.createObjectStore('portfolio');
 request.onsuccess=()=>resolve(request.result);
 request.onerror=()=>reject(request.error);
});
async function mutate(update){
 const db=await database;
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('portfolio','readwrite'),store=tx.objectStore('portfolio'),request=store.get(KEY);
  let result,serialized,changed=false,failure;
  request.onsuccess=()=>{try{
   const data=request.result||JSON.parse(localStorage.getItem(KEY)||'{"lots":[],"alerts":[]}');
   if(!data||!Array.isArray(data.lots)||!Array.isArray(data.alerts))throw Error('Saved portfolio is invalid. Restore a backup.');
   const before=JSON.stringify(data);result=update(data);serialized=JSON.stringify(data);changed=serialized!==before;
   if(changed||!request.result)store.put(data,KEY);
  }catch(e){failure=e;tx.abort();}};
  tx.oncomplete=()=>{
   // Compatibility mirror and cross-tab notification; IndexedDB is authoritative.
   if(changed||localStorage.getItem(KEY)!==serialized)try{localStorage.setItem(KEY,serialized);}catch{}
   resolve(result);
  };
  tx.onabort=()=>reject(failure||tx.error||Error('Could not save portfolio.'));
  tx.onerror=()=>reject(tx.error);
 });
}
function readPortfolio(){return mutate(data=>structuredClone(data));}
export async function importBackup(input){
 if(!input||!Array.isArray(input.lots)||!input.lots.every(x=>x&&positive(x.grams)&&positive(purchaseCost(x))))throw Error('Backup must contain valid gold purchases.');
 const hasAlerts=input.alerts!==undefined;
 if(hasAlerts&&(!Array.isArray(input.alerts)||!input.alerts.every(a=>a&&positive(a.target)&&['above','below'].includes(a.direction)&&(!a.triggeredAt||(Number.isFinite(Date.parse(a.triggeredAt))&&positive(a.actual))))))throw Error('Backup contains invalid alerts. Nothing was imported.');
 const lots=input.lots.map(x=>({id:crypto.randomUUID(),grams:x.grams,totalCost:purchaseCost(x),note:String(x.note||'').slice(0,120)}));
 const alerts=hasAlerts?input.alerts.map(a=>({id:crypto.randomUUID(),target:a.target,direction:a.direction,...(a.triggeredAt?{triggeredAt:a.triggeredAt,actual:a.actual}:{})})):null;
 if(!confirm('Replace purchases with '+lots.length+' imported purchases'+(hasAlerts?' and '+alerts.length+' alert targets?':'? Existing alert targets will be kept.')))return;
 await mutate(data=>{data.lots=lots;if(hasAlerts)data.alerts=alerts;});
}
export async function browserApi(path,method='GET',body){
 if(path==='market'){
  try{const r=await fetch('./market.json?v='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('Price snapshot unavailable');cached=await r.json();localStorage.setItem('goldfolio-pages-market',JSON.stringify(cached));}
  catch(e){cached=cached||JSON.parse(localStorage.getItem('goldfolio-pages-market')||'null');if(!cached)throw e;cached={...cached,error:'Cannot update the price snapshot. Showing saved data.'};}
  if(cached.quote&&!cached.quote.isStale&&Date.now()-Date.parse(cached.quote.updatedAt)<30*60000){
   await mutate(data=>{for(const a of data.alerts)if(!a.triggeredAt&&reached(a,cached.quote.price)){a.triggeredAt=new Date().toISOString();a.actual=cached.quote.price;}});
  }
  return cached;
 }
 if(path==='portfolio')return {...await readPortfolio(),subscribed:false};
 return mutate(data=>{
 if(path==='lots'&&method==='POST'){
  if(!positive(body.grams)||!positive(body.totalCost))throw Error('Enter valid grams and total paid.');
  data.lots.push({id:crypto.randomUUID(),grams:body.grams,totalCost:body.totalCost,note:String(body.note||'').slice(0,120)});
 }else if(path.startsWith('lots/')&&method==='PATCH'){
  const lot=data.lots.find(x=>x.id===path.split('/')[1]);if(!lot)throw Error('Purchase not found');
  if(!positive(body.grams)||!positive(body.totalCost))throw Error('Enter valid grams and total paid.');
  Object.assign(lot,{grams:body.grams,totalCost:body.totalCost,note:String(body.note||'').slice(0,120)});
 }else if(method==='DELETE'&&/^(lots|alerts)\//.test(path)){
  const [type,id]=path.split('/');data[type]=data[type].filter(x=>x.id!==id);
 }else if(path==='alerts'&&method==='POST'){
  if(!positive(body.target)||!['above','below'].includes(body.direction))throw Error('Enter a valid target.');
  data.alerts.push({id:crypto.randomUUID(),target:body.target,direction:body.direction});
 }else throw Error('This feature needs the server version.');
 return {ok:true};
 });
}
