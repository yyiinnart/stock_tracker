const test=require('node:test'),assert=require('node:assert/strict'),c=require('../portfolio-core.js');
const base={_id:'a',code:'AAA',name:'股票',cls:'台股',shares:100,price:100,fx:1,prin:5000,avg:50,note:''};
function add(state,log,shares,price,date){const input={kind:'trade',direction:'buy',shares,price,fee:10,fx:1,fixed:false,tradeDate:date};const t=c.trade(state,input),after={...state,...t.result,lastUp:date.slice(0,7)};return {state:after,log:[...log,{id:'t'+log.length,label:'加碼',input:{...input,...t},changes:c.changes([state],[after])}]};}
function cancel(state,log,index){const p=c.revise([state],log,index);return {state:p.rows[0],log:[...p.audit,{id:'undo'+index,undoOf:log[index].id,undone:true,subjectId:'a',settledAfter:p.rows[0],changes:c.changes([state],p.rows)}]};}
test('永久刪除最早撤銷交易及相關修正，其他交易仍可撤銷回基準',()=>{
 const a=add(base,[],100,100,'2026-10-01'),b=add(a.state,a.log,50,90,'2026-10-02'),x=cancel(b.state,b.log,0);
 x.log.push({id:'revision',revisionOf:'t0',beforeInput:{fee:99}});
 const original=JSON.stringify(x.state),p=c.purge([x.state],x.log,['t0']);
 assert.equal(p.removed,3);assert.equal(p.audit.some(e=>e.id==='t0'||e.undoOf==='t0'||e.revisionOf==='t0'),false);assert.equal(JSON.stringify(x.state),original);
 const remaining=p.audit.findIndex(e=>e.id==='t1'),undo=c.revise([x.state],p.audit,remaining);
 assert.equal(undo.rows[0].shares,base.shares);assert.equal(undo.rows[0].prin,base.prin);
});
test('刪除最後一筆後仍可修改較早交易，並保留新報價',()=>{
 const a=add(base,[],100,100,'2026-10-01'),b=add(a.state,a.log,50,90,'2026-10-02'),x=cancel(b.state,b.log,1),p=c.purge([x.state],x.log,['t1']);
 const idx=p.audit.findIndex(e=>e.id==='t0'),r=c.revise([{...x.state,price:130}],p.audit,idx,{...p.audit[idx].input,shares:20});
 assert.equal(r.rows[0].shares,120);assert.equal(r.rows[0].prin,7010);assert.equal(r.rows[0].price,130);
});
test('批次刪除全部撤銷交易，再新增仍可正常重算與備份往返',()=>{
 const a=add(base,[],100,100,'2026-10-01'),b=add(a.state,a.log,50,90,'2026-10-02'),x=cancel(b.state,b.log,0),y=cancel(x.state,x.log,1),p=c.purge([y.state],y.log,['t0','t1']);
 assert.equal(p.audit.filter(e=>!e.checkpoint).length,0);
 const restored=JSON.parse(JSON.stringify({live:[y.state],audit:p.audit}));c.validate(restored);
 const n=add(restored.live[0],restored.audit,10,80,'2026-10-03'),r=c.revise([n.state],n.log,n.log.length-1);
 assert.equal(r.rows[0].prin,base.prin);assert.equal(r.rows[0].shares,base.shares);
});
test('禁止直接刪除有效交易；刪除失敗不改動資料',()=>{const a=add(base,[],10,100,'2026-10-01'),before=JSON.stringify(a);assert.throws(()=>c.purge([a.state],a.log,['t0']),/先撤銷/);assert.equal(JSON.stringify(a),before);});
test('刪除中間撤銷買入後，修改較早買入仍會正確重算後續賣出',()=>{
 const a=add(base,[],100,100,'2026-10-01'),b=add(a.state,a.log,50,90,'2026-10-02');
 const input={kind:'trade',direction:'sell',shares:40,price:130,fee:10,fx:1,fixed:false,tradeDate:'2026-10-03'},t=c.trade(b.state,input),after={...b.state,...t.result};
 const log=[...b.log,{id:'sale',label:'減碼',input:{...input,...t},changes:c.changes([b.state],[after])}],x=cancel(after,log,1),p=c.purge([x.state],x.log,['t1']);
 const idx=p.audit.findIndex(e=>e.id==='t0'),r=c.revise([x.state],p.audit,idx,{...p.audit[idx].input,shares:20});
 assert.equal(r.rows[0].shares,80);assert.ok(Math.abs(r.rows[0].prin-7010*80/120)<1e-7);
});
test('未記錄的庫存變更與重複識別碼會阻擋刪除',()=>{
 const a=add(base,[],10,100,'2026-10-01'),x=cancel(a.state,a.log,0);
 assert.throws(()=>c.purge([{...x.state,shares:999}],x.log,['t0']),/未記錄/);
 assert.throws(()=>c.purge([x.state],[...x.log,x.log[0]],['t0']),/識別碼重複/);
});
