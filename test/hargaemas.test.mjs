import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeHargaQuote,normalizeHargaHistory} from '../hargaemas.mjs';
import {totals} from '../lib.mjs';
const now=Date.parse('2026-11-21T08:05:00Z');
const sample={lastUpdate:'2026-11-21T16:03:51+08:00',isStale:false,prices:{spotSellRmPerKg:469087.3,spotBuyRmPerKg:462557.42}};
test('HargaEmas kg prices convert to RM per gram with distinct valuation and alert bases',()=>{
 const quote=normalizeHargaQuote(sample,now);
 assert.ok(Math.abs(quote.price-469.0873)<1e-8);assert.equal(quote.sellPrice,quote.price);assert.ok(Math.abs(quote.buyPrice-462.55742)<1e-8);assert.equal(quote.isStale,false);
 const value=totals([{grams:5,totalCost:2000}],quote.buyPrice);assert.ok(Math.abs(value.value-2312.7871)<1e-8);
});
test('HargaEmas rejects missing and invalid values and preserves staleness',()=>{
 assert.throws(()=>normalizeHargaQuote({...sample,prices:{spotSellRmPerKg:NaN}},now));
 assert.throws(()=>normalizeHargaQuote({...sample,lastUpdate:'invalid'},now));
 assert.equal(normalizeHargaQuote({...sample,isStale:true},now).isStale,true);
 assert.equal(normalizeHargaQuote(sample,now+3600000).isStale,true);
});
test('HargaEmas historical prices already use RM/g and retain date precision',()=>{
 const points=normalizeHargaHistory({prices:[{rawDate:'2026-11-20',price:471.113},{rawDate:'2026-11-19',price:489.251},{rawDate:'invalid',price:1}]});
 assert.equal(points[0].price,489.251);assert.equal(points[0].time,'2026-11-19T00:00:00+08:00');assert.equal(points[0].precision,'day');assert.equal(points.length,2);
 assert.throws(()=>normalizeHargaHistory({prices:[]}));
});
