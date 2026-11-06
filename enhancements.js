/* Comparison and auditable position mutations. */
const safeText=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validatePortfolio=PortfolioCore.validate;
const rowId=()=>globalThis.crypto?.randomUUID?.()||`p${Date.now()}${Math.random().toString(36).slice(2)}`;
function ensureRowIds(){data.forEach(r=>{if(!r._id)r._id=rowId();});audit.forEach(a=>{if(!a.id)a.id=rowId();});}
ensureRowIds();
function latestBaseline(){return archLabels().filter(k=>/^\d{6}$/.test(k)&&k<=todayLabel()).sort().pop();}
function priceChange(r,key){const matches=(archives[key]||[]).filter(x=>x.code===r.code&&x.cls===r.cls);const old=matches.length===1?Number(matches[0].price):NaN,now=Number(r.price);return old>0&&now>0&&Number.isFinite(old)&&Number.isFinite(now)?{old,now,delta:now-old,rate:(now-old)/old}:null;}
function changeLabel(c){return !c?'— 無紀錄':c.delta===0?'— 持平':`${c.delta>0?'▲ +':'▼ '}${(c.rate*100).toFixed(2)}%`;}
function openExtra(title,html){let d=document.getElementById('extraDialog');if(!d){d=document.createElement('dialog');d.id='extraDialog';d.style.cssText='width:min(720px,94vw);max-height:85vh;overflow:auto;border:1px solid var(--line);border-radius:14px;padding:24px;background:var(--bg,#fff);color:var(--ink,#222)';document.body.append(d);}d.innerHTML=`<button class="mini-btn" style="float:right" onclick="document.getElementById('extraDialog').close()">關閉</button><h3 id="extraDialogTitle">${safeText(title)}</h3>${html}`;d.setAttribute('aria-labelledby','extraDialogTitle');if(!d.open)d.showModal();}
function showCompare(){const key=document.getElementById('compareDate').value,direction=document.getElementById('compareDirection').value;const rows=data.filter(r=>!['現金','貸款'].includes(r.cls)).map(r=>({r,c:priceChange(r,key)})).filter(x=>direction==='all'||x.c&&(direction==='up'?x.c.delta>0:x.c.delta<0)).sort((a,b)=>(b.c?.rate??-Infinity)-(a.c?.rate??-Infinity));document.getElementById('compareResults').innerHTML=rows.map(({r,c})=>`<tr><td>${safeText(r.code)} ${safeText(r.name)}</td><td>${c?c.old:'—'}</td><td>${safeText(r.price)}</td><td>${c?c.delta.toFixed(2):'—'}</td><td style="color:${c?.delta>0?'#d33':c?.delta<0?'#198754':'inherit'}">${changeLabel(c)}</td></tr>`).join('')||'<tr><td colspan="5">無符合資料</td></tr>';}
function openCompare(){const keys=archLabels().filter(k=>/^\d{6}$/.test(k)).reverse();openExtra('歷史價格比較',`<p>比較日期 <select id="compareDate" onchange="showCompare()">${keys.map(k=>`<option value="${k}">${fmtLabel(k)}</option>`).join('')}</select> <select id="compareDirection" onchange="showCompare()"><option value="all">全部（漲跌幅排序）</option><option value="up">上漲</option><option value="down">下跌</option></select></p><p>原幣價格比較，不含配息或分割調整。最近成功取得報價：${safeText(quoteUpdatedAt?new Date(quoteUpdatedAt).toLocaleString('zh-TW'):'尚無時間紀錄')}（部分標的可能未更新）</p><div style="overflow:auto"><table style="width:100%"><thead><tr><th>股票</th><th>歷史價格</th><th>目前價格</th><th>價差</th><th>漲跌幅</th></tr></thead><tbody id="compareResults"></tbody></table></div>`);showCompare();}
const fieldNames={code:'代碼',name:'名稱',cls:'類別',shares:'股數／餘額',prin:'本金 TWD',avg:'均價',price:'現價',fx:'匯率',note:'備註',lastUp:'更新月份'};
function auditDetails(a){const revision=a.revisionOf?`<b>交易內容修正</b><br>${auditInputChanges(a)}<br>`:'';if(!a.changes)return safeText(a.detail||'舊版紀錄');return revision+a.changes.map(c=>{const b=c.before||{},n=c.after||{};return `<b>${safeText(n.code||b.code)} ${safeText(n.name||b.name)}</b><br>`+Object.keys(fieldNames).filter(k=>JSON.stringify(b[k])!==JSON.stringify(n[k])).map(k=>`${fieldNames[k]}：${safeText(typeof b[k]==='number'?numberText(b[k]):b[k]??'—')} → ${safeText(typeof n[k]==='number'?numberText(n[k]):n[k]??'—')}`).join('<br>');}).join('<hr>')+ (a.input?`<br>${a.input.tradeDate?'交易日期：'+safeText(a.input.tradeDate)+'；':''}輸入方式：${safeText(a.input.source)}；股數 ${safeText(numberText(a.input.shares))}；成交價 ${safeText(numberText(a.input.price))}；金額 ${safeText(numberText(a.input.cost))} TWD${a.input.fee!=null?`；手續費 ${safeText(numberText(a.input.fee))} ${safeText(a.input.currency)}（${safeText(numberText(a.input.feeTWD))} TWD）；匯率 ${safeText(numberText(a.input.fx))}；成交金額 ${safeText(numberText(a.input.gross))} TWD`:''}${a.input.total!=null?`；總支出 ${safeText(numberText(a.input.total))} TWD`:''}${a.input.proceeds!=null?`；實收金額 ${safeText(numberText(a.input.proceeds))} TWD`:''}`:'');}
function openAudit(id){const entries=audit.filter(a=>!id||a.changes?.some(c=>c.id===id));openExtra('操作紀錄',`<button class="mini-btn" onclick="undoLastTrade()">撤銷最近一次操作</button>${entries.slice().reverse().map(a=>`<section style="padding:14px 0;border-bottom:1px solid #aaa"><b>${safeText(a.at)} · ${safeText(a.label)}</b>${a.undone?'（已撤銷）':''}<p>${auditDetails(a)}</p></section>`).join('')||'<p>尚無操作紀錄</p>'}`);}
const originalSaveRow=saveRow,originalDelRow=delRow;
function recordAction(fn,label,input){ensureRowIds();const before=clone(data);fn();ensureRowIds();const changes=PortfolioCore.changes(before,data);if(!changes.length)return;audit.push({id:rowId(),createdAt:new Date().toISOString(),at:new Date().toLocaleString('zh-TW'),label,changes,input});save();persistNow();renderTable();showToast('已儲存，可在操作紀錄核對',undoLastTrade);}
function numberInput(id,optional=false){const value=document.getElementById(id).value.trim();if(optional&&!value)return null;const n=Number(value);if(!value||!Number.isFinite(n))throw Error('請填寫有效的數字');return n;}
saveRow=function(){
  if(!isLive())return;
  let input=null;
  try{
    if(mode==='add'&&editIdx>=0){const r=data[editIdx];
      if(['現金','貸款'].includes(r.cls)){if(numberInput('a_cash')<0)throw Error('請填非負數餘額');input={source:'直接更新餘額',cost:numberInput('a_cash')};}
      else{
        const trade=readTrade(r);
        const tradeDate=document.getElementById('a_date').value;if(!PortfolioCore.validDate(tradeDate))throw Error('請填寫有效交易日期');
        input={source:tradeSource(),shares:numberInput('a_shares'),...trade,kind:'trade',direction:document.getElementById('tradeDirection').value,fixed:document.getElementById('fgCost').style.display!=='none',tradeDate};
        delete input.result;
        commitTrade(r,trade,input);return;
      }
    }else{
      const code=document.getElementById('f_code').value.trim(),cls=document.getElementById('f_cls').value;
      if(!code)throw Error('請填代碼');if(data.some((r,i)=>i!==editIdx&&r.code===code&&r.cls===cls))throw Error('已有同代碼及類別的部位，請編輯原部位');
      const shares=numberInput('f_shares'),fx=numberInput('f_fx'),price=numberInput('f_price',true),avg=numberInput('f_avg',true),principal=numberInput('f_prin',true);
      if(fx<=0||price<0||avg<0||(cls!=='貸款'&&(shares<0||principal<0)))throw Error('請確認股數、本金、價格及匯率範圍');
      if(editIdx>=0&&!confirm(`確認直接修改 ${data[editIdx].code}？\n股數：${data[editIdx].shares} → ${shares}\n本金：${data[editIdx].prin??'—'} → ${principal===null?'—':principal*(document.getElementById('f_prinCur').value==='USD'?fx:1)} TWD\n其他欄位也會記錄修改前後內容。`))return;
    }
    recordAction(originalSaveRow,mode==='add'?'加碼／餘額更新':editIdx<0?'新增部位':'編輯部位',input);
  }catch(e){alert(e.message);}
};
delRow=function(){if(isLive())recordAction(originalDelRow,'刪除部位',null);};
function undoLastTrade(){const i=audit.findLastIndex(a=>!a.checkpoint&&!a.undone&&!a.undoOf&&!a.revisionOf&&a.changes?.length);if(i>=0)undoAuditEntry(i);else alert('沒有可撤銷的操作');}
function localDate(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function commitTrade(row,t,input){
  ensureRowIds();const before=clone(data),next=clone(data),r=next.find(r=>r._id===row._id);
  Object.assign(r,t.result);if(input.direction==='buy')r.lastUp=input.tradeDate.slice(0,7);
  const entry={id:rowId(),createdAt:new Date().toISOString(),at:new Date().toLocaleString('zh-TW'),label:input.direction==='sell'?'減碼':'加碼',tradeDate:input.tradeDate,input,changes:PortfolioCore.changes(before,next)};
  const plan=PortfolioCore.revise(next,[...audit,entry],audit.length,input);
  data=plan.rows;audit=plan.audit;save();persistNow();closeModal();render();showToast('已儲存，可在操作紀錄核對',()=>undoAuditEntry(audit.findIndex(a=>a.id===entry.id)));
}
function applyAuditRevision(index,replacement){
  const old=audit[index],before=clone(data),oldInput=clone(old.input||null),plan=PortfolioCore.revise(data,audit,index,replacement);
  const now=new Date(),entry={id:rowId(),createdAt:now.toISOString(),at:now.toLocaleString('zh-TW'),label:(replacement?'修改交易：':'撤銷：')+old.label,changes:PortfolioCore.changes(before,plan.rows),subjectId:plan.subjectId,settledAfter:plan.rows.find(r=>r._id===plan.subjectId)||null,beforeInput:oldInput,afterInput:replacement?clone(plan.audit[index].input):null};
  if(replacement){entry.revisionOf=old.id;plan.audit[index].revisedAt=now.toISOString();}else{entry.undoOf=old.id;entry.undone=true;plan.audit[index].undoneAt=now.toISOString();}
  data=plan.rows;audit=[...plan.audit,entry];save();persistNow();render();document.getElementById('extraDialog')?.close();showToast(replacement?'交易已修改，後續交易已重算':'已撤銷這筆，後續交易已重算',null);
}
function undoAuditEntry(index){
  try{const plan=PortfolioCore.revise(data,audit,index),a=audit[index];if(!confirm(`撤銷 ${a.label}（${a.input?.tradeDate||auditDay(a)}）？\n會重算此標的後續交易，保留最新報價。`))return;applyAuditRevision(index,null);}
  catch(e){alert(e.message);}
}

const originalRenderTable=renderTable;
renderTable=function(){originalRenderTable();if(!isLive())return;const key=latestBaseline();document.getElementById('hcount').textContent+=key?` · 較 ${fmtLabel(key)}`:' · 尚無快照';document.querySelectorAll('#hbody tr[data-idx]').forEach(tr=>{const r=data[Number(tr.dataset.idx)];const history=document.createElement('button');history.className='mini-btn';history.textContent='◷';history.title='查看此部位操作紀錄';history.setAttribute('aria-label',r.code+' 操作紀錄');history.onclick=e=>{e.stopPropagation();openAudit(r._id);};tr.cells[0].append(history);if(['現金','貸款'].includes(r.cls))return;const c=priceChange(r,key),b=document.createElement('button');b.className='mini-btn';b.style.cssText='display:block;margin-top:5px';b.style.color=c?.delta>0?'#d33':c?.delta<0?'#198754':'inherit';b.textContent=changeLabel(c);b.title=c?`${fmtLabel(key)}：${c.old} → ${c.now}，價差 ${c.delta.toFixed(2)}\n報價取得時間：${r.quoteUpdatedAt?new Date(r.quoteUpdatedAt).toLocaleString('zh-TW'):'尚無紀錄'}`:'該快照無有效價格';b.onclick=e=>{e.stopPropagation();alert(b.title);};tr.cells[0].append(b);});};


// Preview and save share the same fee-inclusive calculation.
const directionBox=document.createElement('input');directionBox.type='hidden';directionBox.id='tradeDirection';directionBox.value='buy';
document.getElementById('addNormal').prepend(directionBox);
function tradeSource(){return document.getElementById('tradeDirection').value==='sell'?'減碼；本金按原持股比例扣除':document.getElementById('fgCost').style.display!=='none'?'固定投入金額（含手續費）':document.getElementById('a_price').value.trim()===''?'現價估算':'自行輸入成交價';}
function readTrade(r){return PortfolioCore.trade(r,{direction:document.getElementById('tradeDirection').value,shares:numberInput('a_shares'),price:numberInput('a_price',true)??r.price,fee:numberInput('a_fee',true)??0,total:document.getElementById('fgCost').style.display!=='none'?numberInput('a_cost'):null});}
const basePrev=prev;
prev=function(){
  if(editIdx<0||['現金','貸款'].includes(data[editIdx].cls)){basePrev();return;}
  const r=data[editIdx],pv=document.getElementById('addPrev'),sell=document.getElementById('tradeDirection').value==='sell';
  if(!document.getElementById('a_shares').value){pv.textContent='填入股數後預覽';return;}
  try{
    const t=readTrade(r),n=t.result;
    const line=(label,value)=>`<div class="trade-preview-row"><span>${label}</span><strong>${value}</strong></div>`;
    pv.innerHTML=line('成交金額',numberText(t.gross)+' TWD')+line('手續費',numberText(t.fee)+' '+t.currency+(t.currency==='USD'?' ≈ '+numberText(t.feeTWD)+' TWD':''))+line(sell?'實收金額':'總支出',numberText(sell?t.proceeds:t.total)+' TWD')+line('股數',numberText(r.shares)+' → '+numberText(n.shares))+line('本金',numberText(r.prin)+' → '+numberText(n.prin)+' TWD')+line('平均成本',numberText(r.avg)+' → '+numberText(n.avg))+(tradeSource()==='現價估算'?'<small>以現價估算</small>':'')+(sell?'<small>本金按持股比例扣除；實收未自動加入現金。</small>':'');
  }catch(e){pv.textContent=e.message;}
};
function updateTradeDirection(){
  if(editIdx<0)return;const r=data[editIdx],sell=document.getElementById('tradeDirection').value==='sell',simple=['現金','貸款'].includes(r.cls);
  document.querySelector('#a_shares').previousElementSibling.textContent='股數';
  document.getElementById('mTitle').textContent=(simple?'':sell?'− ':'＋ ')+r.code+' '+r.name;
  document.getElementById('a_fee_label').textContent='手續費 · '+(r.fx>1.5?'USD':'TWD');
  if(sell){document.getElementById('fgCost').style.display='none';document.getElementById('fgPrice').style.display='block';}prev();
}
const baseOpenEdit=openEdit;
openEdit=function(i){document.getElementById('a_date').value=localDate();document.getElementById('tradeDirection').value='buy';document.getElementById('a_fee').value='0';baseOpenEdit(i);document.getElementById('modeSeg').style.display='none';document.getElementById('delBtn').style.display='none';updateTradeDirection();};
function openTrade(i,direction='buy'){openEdit(i);document.getElementById('tradeDirection').value=direction;updateTradeDirection();}
function openPositionEditor(i){if(!isLive()||!data[i])return;openEdit(i);setMode('edit');document.getElementById('mTitle').textContent=data[i].code+' '+data[i].name;document.querySelector('#ov .modal').scrollTop=0;document.getElementById('f_code').focus({preventScroll:true});}

function auditInputChanges(a){const labels={tradeDate:'交易日期',shares:'股數',price:'成交價',fee:'手續費',fx:'匯率',total:'總支出 TWD'},b=a.beforeInput||{},n=a.afterInput||{};return Object.keys(labels).filter(k=>JSON.stringify(b[k])!==JSON.stringify(n[k])).map(k=>`${labels[k]}：${safeText(typeof b[k]==='number'?numberText(b[k]):b[k]??'—')} → ${safeText(typeof n[k]==='number'?numberText(n[k]):n[k]??'—')}`).join('<br>')||'重新計算後續交易';}
