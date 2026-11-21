import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spotChartPoints,GRAMS_PER_OUNCE} from '../lib.mjs';
import {convertSpotHistory} from '../history.mjs';
test('all timeframes end at the identical latest spot quote',()=>{
 const quote={updatedAt:'2026-11-21T10:00:00Z',price:467.95};
 const market={quote,history:[{time:quote.updatedAt,price:467.95},{time:'2026-11-21T09:00:00Z',price:467}],historical:{points:[{time:'2026-11-19T23:59:59Z',price:460},{time:'2026-11-20T23:59:59Z',price:466},{time:'2026-11-21T23:59:59Z',price:999}]}};
 for(const days of [1,7,30,365]){
  const points=spotChartPoints(market,days,Date.parse(quote.updatedAt));
  assert.equal(points.at(-1).price,quote.price);
  assert.equal(points.at(-1).time,quote.updatedAt);
  assert.equal(points.filter(x=>x.time===quote.updatedAt).length,1);
  assert.ok(!points.some(x=>x.price===999));
 }
 assert.equal(spotChartPoints(market,1,Date.parse(quote.updatedAt)).length,2);
});
test('1D is a rolling 24 hours from now rather than from the last quote',()=>{
 const now=Date.parse('2026-11-21T12:00:00Z');
 const market={quote:{updatedAt:'2026-11-20T11:00:00Z',price:470},history:[{time:'2026-11-20T13:00:00Z',price:469}]};
 assert.deepEqual(spotChartPoints(market,1,now),[{time:'2026-11-20T13:00:00Z',price:469}]);
});
test('spot history accepts only the spot symbol and uses historical FX',()=>{
 const fx={chart:{result:[{timestamp:[Date.parse('2026-01-01')/1000],indicators:{quote:[{close:[4]}]}}]}};
 const payload={symbol:'XAU-USD-SPOT',series:[{date:'2026-01-02',close:String(100*GRAMS_PER_OUNCE)},{date:'2026-01-01',close:String(90*GRAMS_PER_OUNCE)}]};
 const points=convertSpotHistory(payload,fx);assert.equal(points.length,2);assert.ok(Math.abs(points[0].price-360)<1e-8);assert.equal(points[0].time,'2026-01-01T23:59:59Z');
 assert.throws(()=>convertSpotHistory({...payload,symbol:'GC=F'},fx),/spot gold/);
});
