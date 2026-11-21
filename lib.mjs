export const GRAMS_PER_OUNCE = 31.1034768;
export function purchaseCost(lot) { return lot.totalCost ?? lot.grams * lot.buyPrice; }
export function totals(lots, price) {
  const grams = lots.reduce((n, x) => n + x.grams, 0);
  const cost = lots.reduce((n, x) => n + purchaseCost(x), 0);
  const value = price == null ? null : grams * price;
  return { grams, cost, average: grams ? cost / grams : 0, value, gain: value == null ? null : value - cost, percent: cost && value != null ? (value - cost) / cost * 100 : null };
}
export function reached(alert, price) { return alert.direction === 'above' ? price >= alert.target : price <= alert.target; }
export function positive(value) { return typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 1e10; }
export function spotChartPoints(market,days,now=Date.now()){
 const quote=market.quote;
 const end=days===1?now:quote?Date.parse(quote.updatedAt):now;
 const all=[...(days===1?[]:market.historical?.points||[]),...(market.history||[])];
 if(quote)all.push({time:quote.updatedAt,price:quote.price});
 const unique=new Map();
 for(const point of all){const time=Date.parse(point.time);if(Number.isFinite(time)&&positive(point.price)&&time<=end&&time>=end-days*86400000)unique.set(time,point);}
 return [...unique.values()].sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));
}
