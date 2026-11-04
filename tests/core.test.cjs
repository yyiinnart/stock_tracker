const test=require('node:test');const assert=require('node:assert/strict');const core=require('../portfolio-core.js');
const row={_id:'a',code:'A',cls:'台股',shares:100,price:50,fx:1,avg:40,prin:4000};
test('加碼撤銷只還原改動欄位，保留新報價和其他部位',()=>{const after={...row,shares:120,prin:5000,avg:5000/120};const entry={changes:core.changes([row],[after])};const next=core.undo([{...after,price:55,quoteUpdatedAt:'new'},{...row,_id:'b',code:'B'}],entry);assert.equal(next[0].shares,100);assert.equal(next[0].price,55);assert.equal(next[0].quoteUpdatedAt,'new');assert.equal(next.length,2);});
test('後續股數變動阻擋撤銷',()=>{const after={...row,shares:120};assert.throws(()=>core.undo([{...after,shares:130}],{changes:core.changes([row],[after])}),/後續變更/);});
test('新增與刪除可以還原',()=>{assert.deepEqual(core.undo([row],{changes:core.changes([],[row])}),[]);assert.deepEqual(core.undo([],{changes:core.changes([row],[])}),[row]);});
test('刪除後重新新增同代碼不重複還原',()=>{assert.throws(()=>core.undo([{...row,_id:'b'}],{changes:core.changes([row],[])}),/重新建立/);});
test('錯誤匯入資料被拒絕',()=>{assert.throws(()=>core.validate({live:[{...row,shares:'100'}]}));assert.throws(()=>core.validate({live:[row,row]}));assert.throws(()=>core.validate({live:[],archives:{bad:{}}}));assert.equal(core.validate({live:[row]}).live.length,1);});
