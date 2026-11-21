import {test} from 'node:test';
import assert from 'node:assert/strict';
import {totals,reached,GRAMS_PER_OUNCE,positive} from '../lib.mjs';
import {convertHistory} from '../history.mjs';
test('total paid purchases coexist with older per-gram records',()=>{const t=totals([{grams:5,totalCost:2250},{grams:2,buyPrice:400}],500);assert.equal(t.cost,3050);assert.equal(t.value,3500);assert.equal(t.gain,450);});
test('historical conversion uses contemporaneous FX and skips missing closes',()=>{
 const payload=rows=>({chart:{result:[{timestamp:rows.map(r=>Date.parse(r[0])/1000),indicators:{quote:[{close:rows.map(r=>r[1])}]}}]}});
 const g=payload([['2025-01-02',3110.34768],['2025-01-03',null],['2025-01-06',3421.382448]]);
 const fx=payload([['2025-01-02',4],['2025-01-07',5]]);
 const result=convertHistory(g,fx);assert.equal(result.length,2);assert.ok(Math.abs(result[0].price-400)<1e-8);assert.ok(Math.abs(result[1].price-440)<1e-8);
});
test('unavailable historical data fails rather than inventing prices',()=>{assert.throws(()=>convertHistory({},{}),/no prices/);});
test('weighted cost and profit across purchases',()=>{const t=totals([{grams:2,buyPrice:400},{grams:3,buyPrice:500}],550);assert.equal(t.cost,2300);assert.equal(t.grams,5);assert.equal(t.average,460);assert.equal(t.value,2750);assert.equal(t.gain,450);});
test('loss and unavailable price are distinct',()=>{assert.equal(totals([{grams:2,buyPrice:500}],400).gain,-200);assert.equal(totals([{grams:2,buyPrice:500}],null).gain,null);assert.equal(totals([],500).percent,null);});
test('inclusive targets catch crossings without exact equality',()=>{assert.ok(reached({direction:'above',target:500},500));assert.ok(reached({direction:'above',target:500},501));assert.ok(reached({direction:'below',target:500},499));assert.ok(reached({direction:'below',target:500},500));assert.equal(reached({direction:'below',target:500},501),false);});
test('troy ounce conversion and invalid amounts',()=>{assert.equal(3110.34768/GRAMS_PER_OUNCE,100);assert.equal(positive(NaN),false);assert.equal(positive(-1),false);assert.equal(positive('2'),false);});
