/* Shared data rules, also exercised by node tests. */
(function(root){
  const copy=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
  const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  function validate(o){
    if(!o||!Array.isArray(o.live))throw Error('資料缺少持倉清單');
    const row=r=>{
      if(!r||typeof r.code!=='string'||typeof r.cls!=='string')throw Error('持倉代碼或類別不正確');
      for(const k of ['shares','price','fx','avg','prin'])if(r[k]!=null&&(typeof r[k]!=='number'||!Number.isFinite(r[k])))throw Error('持倉數值不正確：'+k);
    };
    (root.StrategyCore||(typeof require==='function'?require('./strategy-core.js'):null))?.validate(o.strategies);
    o.live.forEach(row);
    for(const k of ['dca','cal','yield','recurring','audit'])if(o[k]!=null&&!Array.isArray(o[k]))throw Error('資料格式不正確：'+k);
    if(o.archives!=null){if(typeof o.archives!=='object'||Array.isArray(o.archives))throw Error('快照格式不正確');for(const a of Object.values(o.archives)){if(!Array.isArray(a))throw Error('快照格式不正確');a.forEach(row);}}
    const ids=o.live.map(r=>r._id).filter(Boolean);if(new Set(ids).size!==ids.length)throw Error('持倉識別碼重複');
    return o;
  }
  function changes(before,after){
    const a=new Map(before.map(r=>[r._id,r])),b=new Map(after.map(r=>[r._id,r]));
    return [...new Set([...a.keys(),...b.keys()])].filter(id=>!equal(a.get(id),b.get(id))).map(id=>({id,before:a.get(id)?copy(a.get(id)):null,after:b.get(id)?copy(b.get(id)):null,index:before.findIndex(r=>r._id===id)}));
  }
  function undo(rows,entry){
    if(!entry||entry.undone||!Array.isArray(entry.changes))throw Error('沒有可安全撤銷的操作');
    const out=copy(rows);
    for(const c of entry.changes){
      const i=out.findIndex(r=>r._id===c.id),current=out[i];
      if(!c.before){
        if(!equal(current,c.after))throw Error('新增的部位已有後續變更，請依紀錄手動修正');
        out.splice(i,1);
      }else if(!c.after){
        if(current||out.some(r=>r.code===c.before.code&&r.cls===c.before.cls))throw Error('同一部位已重新建立，無法直接還原');
        out.splice(Math.max(0,c.index),0,copy(c.before));
      }else{
        if(!current)throw Error('此部位已不存在');
        const keys=[...new Set([...Object.keys(c.before),...Object.keys(c.after)])].filter(k=>!equal(c.before[k],c.after[k]));
        for(const k of keys){if(!equal(current[k],c.after[k]))throw Error('此操作的欄位已有後續變更，請依紀錄手動修正');}
        for(const k of keys){if(k in c.before)current[k]=copy(c.before[k]);else delete current[k];}
      }
    }
    return out;
  }
  function trade(row,{direction='buy',shares,price,fee=0,total=null}){
    const fx=row.fx;
    if(!['buy','sell'].includes(direction)||!Number.isFinite(shares)||shares<=0)throw Error('股數必須大於零');
    if(!Number.isFinite(fee)||fee<0)throw Error('手續費必須為非負數');
    if(!Number.isFinite(fx)||fx<=0)throw Error('請填有效匯率');
    if(row.prin==null||!Number.isFinite(row.prin))throw Error('請先補上本金，再使用加減碼');
    const feeTWD=fee*fx,sell=direction==='sell',fixed=!sell&&total!=null;
    if(!fixed&&(!Number.isFinite(price)||price<=0))throw Error('請填有效成交價');
    if(fixed&&(!Number.isFinite(total)||total<=0||feeTWD>=total))throw Error('含手續費總支出必須大於手續費');
    if(sell&&shares>row.shares)throw Error('減碼股數不能超過目前持股');
    const gross=fixed?total-feeTWD:shares*price*fx;
    if(sell&&feeTWD>gross)throw Error('手續費不能超過成交金額');
    const cost=sell?-row.prin*shares/row.shares:fixed?total:gross+feeTWD;
    const nextShares=sell?row.shares-shares:row.shares+shares;
    const principal=nextShares===0?0:row.prin+cost;
    const result={shares:nextShares,prin:principal,avg:nextShares>0?principal/(fx*nextShares):0};
    if(![gross,cost,result.shares,result.prin,result.avg].every(Number.isFinite))throw Error('交易數值超出範圍');
    return {result,cost,gross,fee,feeTWD,currency:fx>1.5?'USD':'TWD',fx,price:fixed?gross/(shares*fx):price,...(sell?{proceeds:gross-feeTWD}:{total:cost})};
  }
  function validDate(value){
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
    const d=new Date(value+'T12:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===value;
  }
  function tradeInput(entry){
    const i=entry.input,c=entry.changes?.[0];
    if(!i||!c?.before||!c.after)return null;
    if(i.kind!=='trade'&&(!Number.isFinite(i.shares)||i.shares<=0))return null;
    const direction=i.direction||(entry.label==='減碼'||i.source?.startsWith('減碼')?'sell':entry.label?.startsWith('加碼')?'buy':null);
    if(!direction)return null;
    return {direction,shares:i.shares,price:i.price,fee:i.fee??0,fx:i.fx??c.before.fx,fixed:i.fixed??(i.price==null||i.source?.includes('固定')),total:i.total??i.cost,tradeDate:i.tradeDate||entry.tradeDate||null};
  }
  // Rebuild only the affected position. Original changes remain available for audit.
  function revise(rows,history,index,replacement=null){
    const entries=copy(history),target=entries[index];
    if(!target||target.checkpoint||target.undone||target.undoOf||target.revisionOf||target.changes?.length!==1)throw Error('這筆紀錄無法修改或撤銷');
    if(replacement&&!tradeInput(target))throw Error('這筆舊紀錄缺少交易明細，無法直接修改交易');
    const id=target.changes[0].id,related=entries.filter(e=>e.changes?.some(c=>c.id===id)||e.subjectId===id);
    const source=related.filter(e=>!e.undoOf&&!e.revisionOf&&e.changes?.some(c=>c.id===id));
    const last=related.at(-1),expected=last.settledAfter!==undefined?last.settledAfter:last.changes?.find(c=>c.id===id)?.after;
    const current=rows.find(r=>r._id===id)||null;
    const near=(a,b)=>typeof a==='number'&&typeof b==='number'?Math.abs(a-b)<=1e-7+Number.EPSILON*16*Math.max(Math.abs(a),Math.abs(b)):equal(a,b);
    if(!!current!==!!expected)throw Error('部位已有未記錄的新增或刪除，請先核對資料');
    for(const k of ['shares','prin','avg','code','name','cls','note','lastUp'])if(current&&!near(current[k],expected[k]))throw Error('部位已有未記錄的後續變更，請先核對資料');
    const controlled=new Set();
    for(const e of source){const c=(e.originalChanges||e.changes).find(c=>c.id===id);for(const k of new Set([...Object.keys(c.before||{}),...Object.keys(c.after||{})]))if(!equal(c.before?.[k],c.after?.[k]))controlled.add(k);}
    if(replacement){if(!target.originalInput)target.originalInput=copy(target.input);if(!validDate(replacement.tradeDate))throw Error('請填寫有效交易日期');target.input={...target.input,...replacement};target.tradeDate=replacement.tradeDate;}
    else target.undone=true;
    let state=copy((source[0].originalChanges||source[0].changes).find(c=>c.id===id).before),block=[];
    const apply=e=>{
      const c=e.changes.find(c=>c.id===id),original=(e.originalChanges||e.changes).find(c=>c.id===id),before=state?copy(state):null;
      if(!e.originalChanges)e.originalChanges=copy(e.changes);
      const t=tradeInput(e);
      if(t){
        if(!state)throw Error('交易所需部位已不存在，無法重算');
        const calc=trade({...state,fx:t.fx},{...t,total:t.fixed?t.total:null});
        state={...state,...calc.result};
        if(t.direction==='buy')state.lastUp=t.tradeDate?t.tradeDate.slice(0,7):c.after.lastUp;
        if(!e.originalInput)e.originalInput=copy(e.input);
        e.input={...e.input,...calc};delete e.input.result;
        controlled.add('shares');controlled.add('prin');controlled.add('avg');controlled.add('lastUp');
      }else if(!original.before){if(state)throw Error('部位已存在，無法重算新增紀錄');state=copy(original.after);}
      else if(!original.after){if(!state)throw Error('部位已刪除，無法重算');state=null;}
      else{
        if(!state)throw Error('後續編輯需要此部位，請先處理後續紀錄');
        for(const k of new Set([...Object.keys(original.before),...Object.keys(original.after)]))if(!equal(original.before[k],original.after[k])){if(k in original.after)state[k]=copy(original.after[k]);else delete state[k];}
      }
      c.before=before;c.after=state?copy(state):null;
    };
    const flush=()=>{
      const key=e=>{const day=tradeInput(e).tradeDate;if(day)return day;const d=new Date(e.createdAt||'');if(Number.isFinite(+d))return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;const m=(e.at||'').match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);return m?`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`:'';};
      block.sort((a,b)=>key(a).localeCompare(key(b)));
      block.forEach(apply);block=[];
    };
    for(const e of source){if(e.undone)continue;if(tradeInput(e))block.push(e);else{flush();apply(e);}}
    flush();
    const out=copy(rows),pos=out.findIndex(r=>r._id===id);
    if(!state){if(pos>=0)out.splice(pos,1);}
    else if(pos<0){if(out.some(r=>r.code===state.code&&r.cls===state.cls))throw Error('同代碼部位已重新建立，無法還原');out.splice(Math.max(0,target.changes[0].index),0,state);}
    else{
      for(const k of controlled){
        if(k==='price'||k==='fx'||k==='quoteUpdatedAt'){if(!near(current[k],expected[k]))continue;}
        if(k in state)out[pos][k]=copy(state[k]);else delete out[pos][k];
      }
    }
    const tail=related.at(-1);tail.settledAfter=out.find(r=>r._id===id)||null;
    return {rows:out,audit:entries,subjectId:id};
  }
  function purge(rows,history,ids){
    const roots=new Set(ids),remove=new Set(ids),entries=copy(history);
    if(!roots.size)throw Error('沒有可刪除的已撤銷紀錄');
    for(const id of roots){if(entries.filter(e=>e.id===id).length!==1)throw Error('紀錄識別碼重複或不存在，請先核對資料');const e=entries.find(e=>e.id===id);if(!e||!e.undone||e.undoOf||e.revisionOf||e.checkpoint)throw Error('有效交易須先撤銷，才能永久刪除');}
    let changed=true;
    while(changed){changed=false;for(const e of entries)if(!remove.has(e.id)&&(remove.has(e.undoOf)||remove.has(e.revisionOf))){remove.add(e.id);changed=true;}}
    const subjects=new Set(entries.filter(e=>remove.has(e.id)).flatMap(e=>[...(e.changes||[]).map(c=>c.id),e.subjectId].filter(Boolean)));
    let remaining=entries.filter(e=>!remove.has(e.id));
    for(const id of subjects){
      const prior=entries.filter(e=>e.changes?.some(c=>c.id===id)),first=prior.find(e=>!e.undoOf&&!e.revisionOf);
      const active=remaining.some(e=>!e.checkpoint&&!e.undone&&!e.undoOf&&!e.revisionOf&&e.changes?.some(c=>c.id===id));
      const current=rows.find(r=>r._id===id)||null;
      const last=entries.findLast(e=>e.subjectId===id||e.changes?.some(c=>c.id===id)),expected=last?.settledAfter!==undefined?last.settledAfter:last?.changes?.find(c=>c.id===id)?.after;
      const same=(a,b)=>typeof a==='number'&&typeof b==='number'?Math.abs(a-b)<=1e-7+Number.EPSILON*16*Math.max(Math.abs(a),Math.abs(b)):equal(a,b);
      if(!!current!==!!expected||current&&['shares','prin','avg','code','name','cls','note','lastUp'].some(k=>!same(current[k],expected[k])))throw Error('部位已有未記錄的變更，請先核對再刪除紀錄');
      const basis=active?(first?.originalChanges||first?.changes)?.find(c=>c.id===id)?.before:current;
      remaining=remaining.filter(e=>!(e.checkpoint&&e.subjectId===id));
      if(active||current){
        remaining.unshift({id:'basis:'+id,checkpoint:true,subjectId:id,changes:[{id,before:copy(basis??null),after:copy(basis??null),index:first?.changes?.find(c=>c.id===id)?.index??0}]});
        const tail=remaining.findLast(e=>e.subjectId===id||e.changes?.some(c=>c.id===id));tail.settledAfter=copy(current);
      }
    }
    return {audit:remaining,removed:entries.filter(e=>remove.has(e.id)).length,roots:roots.size};
  }
  function comparisonRows(live,snapshot,snapshotDate='',snapshotTarget=false){
    const groups=new Map(),positive=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
    const time=v=>{const n=Date.parse(v||'');return Number.isFinite(n)?n:null;};
    for(const [side,list] of [['live',live],['old',snapshot]])for(const r of list||[]){
      if(['現金','貸款'].includes(r.cls))continue;
      const key=JSON.stringify([r.code,r.cls]);if(!groups.has(key))groups.set(key,{live:[],old:[]});groups.get(key)[side].push(r);
    }
    return [...groups.values()].flatMap(g=>{
      const held=g.live.some(r=>positive(r.shares)),had=g.old.some(r=>positive(r.shares)),unknownOld=g.old.some(r=>r.shares==null),unknownCurrent=g.live.some(r=>r.shares==null);
      if(!held&&!had&&!unknownOld&&!unknownCurrent)return [];
      const now=g.live.length===1?g.live[0]:null,old=g.old.length===1?g.old[0]:null,r=g.live[0]||g.old[0];
      const status=!held&&!unknownCurrent&&had?'sold':held&&!had&&!unknownOld?'new':'';
      const quoteTime=time(now?.quoteUpdatedAt),cutoff=time(old?.quoteUpdatedAt)??time(snapshotDate?snapshotDate+'T00:00:00':'');
      const retained=quoteTime!=null&&(cutoff==null||quoteTime>=cutoff);
      const currentPrice=positive(now?.price)&&(snapshotTarget||held||unknownCurrent||retained)?now.price:null,oldPrice=positive(old?.price)?old.price:null;
      const candidate=currentPrice!=null&&oldPrice!=null?{old:oldPrice,now:currentPrice,delta:currentPrice-oldPrice,rate:(currentPrice-oldPrice)/oldPrice}:null,c=candidate&&Number.isFinite(candidate.delta)&&Number.isFinite(candidate.rate)?candidate:null;
      const profit=held&&c&&positive(now?.shares)&&positive(now?.fx)?c.delta*now.shares*now.fx:null,pnl=Number.isFinite(profit)?profit:null;
      return [{r,status,oldPrice,currentPrice,c,pnl,shares:now?now.shares??null:0,fx:now?.fx??null,quoteUpdatedAt:currentPrice!=null?now?.quoteUpdatedAt||'':null}];
    });
  }
  function sortComparisons(rows,metric='rate',ascending=false){
    const code=(a,b)=>String(a.r.code).localeCompare(String(b.r.code),'zh-TW',{numeric:true})||String(a.r.code).localeCompare(String(b.r.code))||String(a.r.cls).localeCompare(String(b.r.cls));
    return [...rows].sort((a,b)=>{
      const av=metric==='pnl'?a.pnl:metric==='code'?(a.c?0:null):a.c?.rate,bv=metric==='pnl'?b.pnl:metric==='code'?(b.c?0:null):b.c?.rate;
      if(av==null||bv==null)return av==null?(bv==null?code(a,b):1):-1;
      const delta=metric==='code'?code(a,b):av-bv;
      return (ascending?delta:-delta)||code(a,b);
    });
  }
  root.PortfolioCore={validate,changes,undo,trade,validDate,tradeInput,revise,purge,comparisonRows,sortComparisons};
  if(typeof module!=='undefined')module.exports=root.PortfolioCore;
})(globalThis);
