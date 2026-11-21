import { GRAMS_PER_OUNCE, positive } from './lib.mjs';
function rows(payload) {
 const result=payload.chart?.result?.[0];
 if(!result?.timestamp || !result.indicators?.quote?.[0]?.close)throw Error('Historical provider returned no prices');
 return result.timestamp.map((t,i)=>({day:new Date(t*1000).toISOString().slice(0,10),value:result.indicators.quote[0].close[i]})).filter(r=>positive(r.value)).sort((a,b)=>a.day.localeCompare(b.day));
}
export function convertHistory(goldPayload,fxPayload){
 const gold=rows(goldPayload),fx=rows(fxPayload);let index=-1;const points=[];
 for(const g of gold){
  while(index+1<fx.length && fx[index+1].day<=g.day)index++;
  if(index<0 || Date.parse(g.day)-Date.parse(fx[index].day)>7*86400000)continue;
  points.push({time:g.day+'T12:00:00Z',price:g.value*fx[index].value/GRAMS_PER_OUNCE});
 }
 if(points.length<2)throw Error('Not enough historical gold and MYR prices');
 return points;
}
export const SPOT_SOURCE = 'goldprice.dev-spot-v1';
export function convertSpotHistory(payload,fxPayload){
 if(payload.symbol!=='XAU-USD-SPOT'||!Array.isArray(payload.series))throw Error('Expected spot gold history');
 const series=payload.series.filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x.date)&&positive(Number(x.close))).sort((a,b)=>a.date.localeCompare(b.date));
 const shaped={chart:{result:[{timestamp:series.map(x=>Date.parse(x.date)/1000),indicators:{quote:[{close:series.map(x=>Number(x.close))}]}}]}};
 return convertHistory(shaped,fxPayload).map(x=>({...x,time:x.time.slice(0,10)+'T23:59:59Z'}));
}
