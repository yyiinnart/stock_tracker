const test=require('node:test'),assert=require('node:assert/strict'),c=require('../portfolio-core.js');
const row=(code,shares,price,extra={})=>({code,name:code,cls:'台股',shares,price,fx:1,...extra});
test('快照區段採選定端股數匯率，較早快照的保存價格仍可比較',()=>{
 const left=[row('A',5,120,{fx:32}),row('SOLD',0,60)],right=[row('A',10,100),row('SOLD',10,50)];
 const rows=c.comparisonRows(left,right,'2026-11-04',true);
 assert.equal(rows[0].pnl,3200);assert.equal(rows[0].c.rate,.2);
 assert.equal(rows[1].currentPrice,60);assert.equal(rows[1].pnl,null);assert.equal(rows[1].status,'sold');
 const reverse=c.comparisonRows(right,left,'2026-11-04',true);
 assert.equal(reverse[0].c.delta,-20);assert.equal(reverse[0].pnl,-200);
});
test('聯集包含已賣出、新增持倉；缺少報價不以歷史價格補值',()=>{
 const rows=c.comparisonRows([row('HOLD',10,110),row('NEW',5,80),row('ZERO',0,60)], [row('HOLD',20,100),row('SOLD',10,50),row('ZERO',0,40)],'2026-11-04');
 assert.equal(rows.length,3);const sold=rows.find(r=>r.r.code==='SOLD');assert.equal(sold.status,'sold');assert.equal(sold.oldPrice,50);assert.equal(sold.currentPrice,null);assert.equal(sold.c,null);assert.equal(sold.pnl,null);
 assert.equal(rows.find(r=>r.r.code==='NEW').status,'new');assert.equal(rows.find(r=>r.r.code==='NEW').oldPrice,null);assert.equal(rows.find(r=>r.r.code==='HOLD').pnl,100);
});
test('已清倉但有保留且不早於快照的報價，可比價格、不計持倉損益',()=>{
 const old=[row('SOLD',10,50)];let r=c.comparisonRows([row('SOLD',0,60,{quoteUpdatedAt:'2026-11-05T08:00:00Z'})],old,'2026-11-04')[0];
 assert.equal(r.status,'sold');assert.equal(r.c.rate,.2);assert.equal(r.pnl,null);
 r=c.comparisonRows([row('SOLD',0,60,{quoteUpdatedAt:'2026-11-01T08:00:00Z'})],old,'2026-11-04')[0];assert.equal(r.currentPrice,null);
 r=c.comparisonRows([row('SOLD',0,60)],old,'2026-11-04')[0];assert.equal(r.currentPrice,null);
});
test('兩端價格獨立顯示，缺少目前報價不會隱藏有效快照價',()=>{
 const r=c.comparisonRows([row('A',10,0)],[row('A',10,50)])[0];assert.equal(r.oldPrice,50);assert.equal(r.currentPrice,null);assert.equal(r.c,null);
});
test('升降序缺值固定最後，數值相同依代碼穩定排序',()=>{
 const rows=c.comparisonRows([row('B',10,110),row('A',10,110),row('Z',5,200)],[row('B',10,100),row('A',10,100),row('MISSING',10,50)]);
 for(const ascending of [false,true]){const r=c.sortComparisons(rows,'rate',ascending);assert.deepEqual(r.slice(0,2).map(x=>x.r.code),['A','B']);assert.equal(r.at(-1).c,null);}
 assert.deepEqual(c.sortComparisons(rows,'code',true).map(r=>r.r.code),['A','B','MISSING','Z']);
 assert.deepEqual(c.sortComparisons(rows,'code',false).map(r=>r.r.code),['B','A','MISSING','Z']);
});
test('同代碼不同類別不混用；現金貸款排除',()=>{
 const r=c.comparisonRows([row('SAME',10,100),row('SAME',10,50,{cls:'美股',fx:32}),row('CASH',1000,1,{cls:'現金'})],[row('SAME',10,80)]);
 assert.equal(r.length,2);assert.equal(r.find(r=>r.r.cls==='台股').c.delta,20);assert.equal(r.find(r=>r.r.cls==='美股').status,'new');
});

test('舊紀錄缺少股數時，不推測為已賣出或新增持倉',()=>{
 const rows=c.comparisonRows([row('A',10,120),row('B',undefined,60)],[row('A',undefined,100),row('B',5,50),row('C',undefined,30)]);
 assert.equal(rows.find(r=>r.r.code==='A').status,'');assert.equal(rows.find(r=>r.r.code==='B').status,'');assert.equal(rows.find(r=>r.r.code==='C').status,'');
});
