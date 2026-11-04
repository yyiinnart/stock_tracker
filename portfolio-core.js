/* Shared data rules, also exercised by node tests. */
(function(root){
  const copy=x=>JSON.parse(JSON.stringify(x));
  const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  function validate(o){
    if(!o||!Array.isArray(o.live))throw Error('資料缺少持倉清單');
    const row=r=>{
      if(!r||typeof r.code!=='string'||typeof r.cls!=='string')throw Error('持倉代碼或類別不正確');
      for(const k of ['shares','price','fx','avg','prin'])if(r[k]!=null&&(typeof r[k]!=='number'||!Number.isFinite(r[k])))throw Error('持倉數值不正確：'+k);
    };
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
  root.PortfolioCore={validate,changes,undo};
  if(typeof module!=='undefined')module.exports=root.PortfolioCore;
})(globalThis);
