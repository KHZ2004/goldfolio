import {positive,reached,purchaseCost} from './lib.mjs';
const KEY='goldfolio-pages-portfolio-v1';
let data=JSON.parse(localStorage.getItem(KEY)||'{"lots":[],"alerts":[]}');
let cached=null;
function save(){localStorage.setItem(KEY,JSON.stringify(data));}
export function importBackup(input){
 if(!Array.isArray(input.lots)||!input.lots.every(x=>positive(x.grams)&&positive(purchaseCost(x))))throw Error('Backup must contain valid gold purchases.');
 if(!confirm('Replace the purchases in this browser with '+input.lots.length+' imported purchases?'))return;
 data.lots=input.lots.map(x=>({id:crypto.randomUUID(),grams:x.grams,totalCost:purchaseCost(x),note:String(x.note||'').slice(0,120)}));save();
}
export async function browserApi(path,method='GET',body){
 if(path==='market'){
  try{const r=await fetch('./market.json?v='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('Price snapshot unavailable');cached=await r.json();localStorage.setItem('goldfolio-pages-market',JSON.stringify(cached));}
  catch(e){cached=cached||JSON.parse(localStorage.getItem('goldfolio-pages-market')||'null');if(!cached)throw e;cached={...cached,error:'Cannot update the price snapshot. Showing saved data.'};}
  if(cached.quote&&!cached.quote.isStale&&Date.now()-Date.parse(cached.quote.updatedAt)<30*60000){
   for(const a of data.alerts)if(!a.triggeredAt&&reached(a,cached.quote.price)){a.triggeredAt=new Date().toISOString();a.actual=cached.quote.price;}
   save();
  }
  return cached;
 }
 if(path==='portfolio')return {lots:data.lots,alerts:data.alerts,subscribed:false};
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
 save();return {ok:true};
}
