import {positive} from './lib.mjs';
export const HARGA_SOURCE='hargaemas-myr-v1';
export function normalizeHargaQuote(data,now=Date.now()){
 const sell=data.prices?.spotSellRmPerKg,buy=data.prices?.spotBuyRmPerKg;
 const timestamp=Date.parse(data.lastUpdate);
 if(!positive(sell)||!positive(buy)||!Number.isFinite(timestamp)||timestamp>now+5*60000)throw Error('Invalid HargaEmas.my quote');
 return {sourceId:HARGA_SOURCE,price:sell/1000,sellPrice:sell/1000,buyPrice:buy/1000,updatedAt:data.lastUpdate,fetchedAt:new Date(now).toISOString(),isStale:data.isStale!==false||now-timestamp>15*60000,delayed:false,source:'HargaEmas.my - Malaysian spot buy/sell reference, RM per gram'};
}
export function normalizeHargaHistory(data){
 if(!Array.isArray(data.prices))throw Error('HargaEmas.my history unavailable');
 const days=new Map();
 for(const row of data.prices){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(row.rawDate)||!positive(row.price)||!Number.isFinite(Date.parse(row.rawDate)))continue;
  // A dated daily reference, not an invented intraday observation or close.
  days.set(row.rawDate,{time:row.rawDate+'T00:00:00+08:00',price:row.price,precision:'day'});
 }
 const points=[...days.values()].sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));
 if(points.length<2)throw Error('Not enough valid HargaEmas.my historical prices');
 return points;
}
