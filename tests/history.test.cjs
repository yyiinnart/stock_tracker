const test=require('node:test'),assert=require('node:assert/strict'),c=require('../portfolio-core.js');
const base={_id:'a',code:'AAA',name:'股票',cls:'台股',shares:100,price:100,fx:1,prin:5000,avg:50,note:''};
function add(state,log,direction,shares,price,date){
 const input={direction,shares,price,fee:10,fx:1,fixed:false,tradeDate:date,kind:'trade'};
 const t=c.trade(state,input),after={...state,...t.result};if(direction==='buy')after.lastUp=date.slice(0,7);
 return {state:after,log:[...log,{id:'t'+log.length,label:direction==='buy'?'加碼':'減碼',input:{...input,...t},changes:c.changes([state],[after])}]};
}
test('撤銷較早買入會重算後續賣出，保留新報價與其他部位',()=>{
 let a=add(base,[],'buy',100,100,'2026-10-01'),b=add(a.state,a.log,'sell',50,120,'2026-10-02');
 const p=c.revise([{...b.state,price:130},{...base,_id:'b',code:'OTHER'}],b.log,0);
 assert.equal(p.rows[0].shares,50);assert.equal(p.rows[0].prin,2500);assert.equal(p.rows[0].price,130);assert.equal(p.rows[1].shares,100);
 assert.equal(p.audit[0].undone,true);assert.equal(p.audit[1].input.cost,-2500);
 assert.ok(p.audit[1].originalChanges);
});
test('修改買入數量費用及日期，重排後可再次修改或撤銷',()=>{
 let a=add(base,[],'buy',100,100,'2026-10-01'),b=add(a.state,a.log,'buy',20,90,'2026-10-02');
 const input={...a.log[0].input,shares:50,fee:20,tradeDate:'2026-10-03'};
 let p=c.revise([b.state],b.log,0,input);assert.equal(p.rows[0].shares,170);assert.equal(p.rows[0].prin,11830);
 p=c.revise(p.rows,p.audit,0,null);assert.equal(p.rows[0].shares,120);assert.equal(p.rows[0].prin,6810);
 p=c.revise(p.rows,p.audit,1,null);assert.equal(p.rows[0].shares,100);assert.equal(p.rows[0].prin,5000);
});
test('無法重算的超賣不改動原資料',()=>{
 let a=add(base,[],'buy',100,100,'2026-10-01'),b=add(a.state,a.log,'sell',150,120,'2026-10-02');
 const original=JSON.stringify(b);assert.throws(()=>c.revise([b.state],b.log,0),/超過/);assert.equal(JSON.stringify(b),original);
});
test('手動校準是絕對數值，撤銷後重新計算保留的交易',()=>{
 const manual={...base,prin:8000,avg:80},entry={id:'e',label:'編輯部位',changes:c.changes([base],[manual])};
 const b=add(manual,[entry],'buy',10,100,'2026-10-02');const p=c.revise([b.state],b.log,0);
 assert.equal(p.rows[0].prin,6010);assert.equal(p.rows[0].shares,110);
});
test('新增、刪除可單筆撤銷；重建的同代碼部位不被覆蓋',()=>{
 const create={id:'create',label:'新增部位',changes:c.changes([],[base])};assert.equal(c.revise([base],[create],0).rows.length,0);
 const del={id:'del',label:'刪除部位',changes:c.changes([base],[])};assert.deepEqual(c.revise([],[del],0).rows,[base]);
 assert.throws(()=>c.revise([{...base,_id:'other'}],[del],0),/重新建立/);
});
test('舊交易缺少費用仍可重算；未記錄的庫存更動會阻擋',()=>{
 const a=add(base,[],'buy',10,100,'2026-10-02');delete a.log[0].input.fee;
 assert.equal(c.tradeInput(a.log[0]).fee,0);assert.throws(()=>c.revise([{...a.state,shares:999}],a.log,0),/未記錄/);
});
test('真實曆日驗證',()=>{assert.equal(c.validDate('2026-02-30'),false);assert.equal(c.validDate('2024-02-29'),true);assert.equal(c.validDate('2026-1-1'),false);});
