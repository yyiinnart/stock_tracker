/* User-owned strategy data. Defaults contain names only, never trading rules. */
(function(root){
 const names=['板塊一：一般股票','板塊二：高股息','板塊三：債券','板塊四：出場觀察'];
 const ids=['b1','b2','b3','b4'];
 function groupId(id){return id==='exit'||id==='出場程序中'?'b4':ids.includes(id)?id:null;}
 function defaults(){return {version:1,groups:ids.map((id,i)=>({id,name:names[i],cards:[],rules:[],note:''})),legacyNotesImported:false};}
 function validate(value){
  if(value==null)return;
  if(typeof value!=='object'||Array.isArray(value)||value.version!==1||!Array.isArray(value.groups)||value.groups.length!==4)throw Error('操作策略格式不正確');
  if(new Set(value.groups.map(g=>g?.id)).size!==4)throw Error('操作策略板塊重複');
  for(const g of value.groups){
   if(!ids.includes(g.id)||typeof g.name!=='string'||!g.name.trim()||typeof g.note!=='string'||!Array.isArray(g.cards)||!Array.isArray(g.rules))throw Error('操作策略板塊格式不正確');
   const cardIds=new Set();
   for(const c of g.cards){if(!c||typeof c.id!=='string'||cardIds.has(c.id)||typeof c.title!=='string'||typeof c.content!=='string'||typeof c.collapsed!=='boolean')throw Error('策略卡格式不正確');cardIds.add(c.id);}
   for(const r of g.rules){if(!r||typeof r.action!=='string'||!r.action.trim()||typeof r.description!=='string'||!['lt','lte','gt','gte','between'].includes(r.op)||!Number.isFinite(r.value)||r.value<0||(r.op==='between'&&(!Number.isFinite(r.upper)||r.upper<r.value)))throw Error('殖利率規則格式不正確');}
  }
 }
 function normalize(value,notes){
  validate(value);const out=value?JSON.parse(JSON.stringify(value)):defaults();
  out.groups.sort((a,b)=>ids.indexOf(a.id)-ids.indexOf(b.id));
  if(!out.legacyNotesImported){
   if(typeof notes==='string'&&notes.trim()&&!out.groups[0].cards.some(c=>c.content===notes))out.groups[0].cards.push({id:'legacy-notes',title:'操作策略筆記',content:notes,collapsed:false});
   out.legacyNotesImported=true;
  }
  return out;
 }
 function match(rule,yieldValue){const n=Number((yieldValue*100).toPrecision(12));return rule.op==='lt'?n<rule.value:rule.op==='lte'?n<=rule.value:rule.op==='gt'?n>rule.value:rule.op==='gte'?n>=rule.value:n>=rule.value&&n<=rule.upper;}
 function hasData(value){return !!value?.groups?.some((g,i)=>g.name!==names[i]||g.note||g.cards?.length||g.rules?.length);}
 root.StrategyCore={defaults,normalize,validate,groupId,match,hasData};
 if(typeof module!=='undefined')module.exports=root.StrategyCore;
})(globalThis);
