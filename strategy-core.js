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
   g.rules.forEach(validateRule);
   g.cards.forEach(c=>{if(c.rules!=null){if(!Array.isArray(c.rules))throw Error('策略卡規則格式不正確');c.rules.forEach(validateRule);}});
  }
 }
 function validateRule(r){
  if(!r||typeof r.action!=='string'||!r.action.trim()||typeof r.description!=='string')throw Error('請填寫規則行動');
  const kind=r.kind||'yield',num=v=>Number.isFinite(v)&&v>=0;
  if(!['yield','price','recurring','limit'].includes(kind))throw Error('規則類型不正確');
  if(['yield','price'].includes(kind)&&(!['lt','lte','gt','gte','between'].includes(r.op)||!num(r.value)||(r.op==='between'&&(!num(r.upper)||r.upper<r.value))))throw Error('請填寫有效門檻與區間');
  if(['price','recurring'].includes(kind)&&(!r.subject?.trim()||!num(r.amount)||r.amount<=0))throw Error('請填寫標的與有效股數或金額');
  if(['price','recurring'].includes(kind)&&!['TWD','USD'].includes(r.currency))throw Error('請選擇幣別');
  if(kind==='price'&&(!['shares','budget'].includes(r.allocation)||!['pending','done','paused'].includes(r.status)))throw Error('請選擇配置與執行狀態');
  if(kind==='recurring'&&!['monthly','weekly','yearly'].includes(r.frequency))throw Error('請選擇頻率');
  if(kind==='limit'&&(!['cash','cooldown','budget','manual'].includes(r.limitType)||(r.limitType==='manual'?!r.label?.trim():!num(r.value))))throw Error('請填寫限制條件');
  if(r.conditions!=null){if(!Array.isArray(r.conditions))throw Error('附加條件格式不正確');for(const c of r.conditions){if(!c||!['cash','months','cooldown','manual'].includes(c.kind)||typeof c.text!=='string'||(c.kind==='manual'?!c.text.trim():!num(c.value)))throw Error('請填寫附加條件');if(c.kind==='cash'&&(!['TWD','USD'].includes(c.currency)||!['gt','gte','lt','lte'].includes(c.op)))throw Error('現金條件格式不正確');}}
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
 function match(rule,yieldValue){if((rule.kind||'yield')!=='yield')return false;const n=Number((yieldValue*100).toPrecision(12));return rule.op==='lt'?n<rule.value:rule.op==='lte'?n<=rule.value:rule.op==='gt'?n>rule.value:rule.op==='gte'?n>=rule.value:n>=rule.value&&n<=rule.upper;}
 function hasData(value){return !!value?.groups?.some((g,i)=>g.name!==names[i]||g.note||g.cards?.length||g.rules?.length);}
 root.StrategyCore={defaults,normalize,validate,validateRule,groupId,match,hasData};
 if(typeof module!=='undefined')module.exports=root.StrategyCore;
})(globalThis);
