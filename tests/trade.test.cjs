const test=require('node:test'),assert=require('node:assert/strict'),core=require('../portfolio-core.js');
const row={_id:'a',code:'0050',cls:'台股',shares:3381,price:97.3,fx:1,avg:105.03,prin:355097};
test('買進含手續費並可撤銷，保留後續報價',()=>{
 const t=core.trade(row,{shares:200,price:97.3,fee:28});
 assert.equal(t.total,19488);assert.equal(t.result.prin,374585);assert.equal(t.result.shares,3581);
 assert.equal(t.result.avg,374585/3581);
 const after={...row,...t.result};const restored=core.undo([{...after,price:110}],{changes:core.changes([row],[after])});
 assert.equal(restored[0].prin,row.prin);assert.equal(restored[0].shares,row.shares);assert.equal(restored[0].price,110);
});
test('外幣交易費換算與定期定額不重複加計',()=>{
 const usd={...row,fx:32};let t=core.trade(usd,{shares:2,price:100,fee:1.5});
 assert.equal(t.feeTWD,48);assert.equal(t.total,6448);assert.equal(t.currency,'USD');
 t=core.trade(usd,{shares:2,fee:1.5,total:6400});assert.equal(t.gross,6352);assert.equal(t.total,6400);assert.equal(t.price,99.25);
});
test('減碼扣除比例成本及手續費，全部賣出歸零',()=>{
 const r={...row,shares:100,prin:5000,avg:50};let t=core.trade(r,{direction:'sell',shares:20,price:100,fee:28});
 assert.equal(t.proceeds,1972);assert.equal(t.result.prin,4000);assert.equal(t.result.avg,50);
 t=core.trade(r,{direction:'sell',shares:100,price:100,fee:28});assert.deepEqual(t.result,{shares:0,prin:0,avg:0});
});
test('拒絕無效費用、超賣與無效總支出',()=>{
 for(const fee of [-1,NaN,Infinity])assert.throws(()=>core.trade(row,{shares:1,price:100,fee}));
 assert.throws(()=>core.trade(row,{direction:'sell',shares:4000,price:100}));
 assert.throws(()=>core.trade(row,{shares:1,fee:28,total:20}));
 assert.throws(()=>core.trade(row,{direction:'sell',shares:1,price:20,fee:28}));
 assert.throws(()=>core.trade({...row,prin:null},{shares:1,price:100}));
});
