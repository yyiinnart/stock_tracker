/* Comparison and auditable position mutations. */
const safeText=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validatePortfolio=PortfolioCore.validate;
const rowId=()=>globalThis.crypto?.randomUUID?.()||`p${Date.now()}${Math.random().toString(36).slice(2)}`;
function ensureRowIds(){data.forEach(r=>{if(!r._id)r._id=rowId();});}
ensureRowIds();
function latestBaseline(){return archLabels().filter(k=>/^\d{6}$/.test(k)&&k<=todayLabel()).sort().pop();}
function priceChange(r,key){const matches=(archives[key]||[]).filter(x=>x.code===r.code&&x.cls===r.cls);const old=matches.length===1?Number(matches[0].price):NaN,now=Number(r.price);return old>0&&now>0&&Number.isFinite(old)&&Number.isFinite(now)?{old,now,delta:now-old,rate:(now-old)/old}:null;}
function changeLabel(c){return !c?'— 無紀錄':c.delta===0?'— 持平':`${c.delta>0?'▲ +':'▼ '}${(c.rate*100).toFixed(2)}%`;}
function openExtra(title,html){let d=document.getElementById('extraDialog');if(!d){d=document.createElement('dialog');d.id='extraDialog';d.style.cssText='width:min(720px,94vw);max-height:85vh;overflow:auto;border:1px solid var(--line);border-radius:14px;padding:24px;background:var(--bg,#fff);color:var(--ink,#222)';document.body.append(d);}d.innerHTML=`<button class="mini-btn" style="float:right" onclick="document.getElementById('extraDialog').close()">關閉</button><h3 id="extraDialogTitle">${safeText(title)}</h3>${html}`;d.setAttribute('aria-labelledby','extraDialogTitle');if(!d.open)d.showModal();}
function showCompare(){const key=document.getElementById('compareDate').value,direction=document.getElementById('compareDirection').value;const rows=data.filter(r=>!['現金','貸款'].includes(r.cls)).map(r=>({r,c:priceChange(r,key)})).filter(x=>direction==='all'||x.c&&(direction==='up'?x.c.delta>0:x.c.delta<0)).sort((a,b)=>(b.c?.rate??-Infinity)-(a.c?.rate??-Infinity));document.getElementById('compareResults').innerHTML=rows.map(({r,c})=>`<tr><td>${safeText(r.code)} ${safeText(r.name)}</td><td>${c?c.old:'—'}</td><td>${safeText(r.price)}</td><td>${c?c.delta.toFixed(2):'—'}</td><td style="color:${c?.delta>0?'#d33':c?.delta<0?'#198754':'inherit'}">${changeLabel(c)}</td></tr>`).join('')||'<tr><td colspan="5">無符合資料</td></tr>';}
function openCompare(){const keys=archLabels().filter(k=>/^\d{6}$/.test(k)).reverse();openExtra('歷史價格比較',`<p>比較日期 <select id="compareDate" onchange="showCompare()">${keys.map(k=>`<option value="${k}">${fmtLabel(k)}</option>`).join('')}</select> <select id="compareDirection" onchange="showCompare()"><option value="all">全部（漲跌幅排序）</option><option value="up">上漲</option><option value="down">下跌</option></select></p><p>原幣價格比較，不含配息或分割調整。最近成功取得報價：${safeText(quoteUpdatedAt?new Date(quoteUpdatedAt).toLocaleString('zh-TW'):'尚無時間紀錄')}（部分標的可能未更新）</p><div style="overflow:auto"><table style="width:100%"><thead><tr><th>股票</th><th>歷史價格</th><th>目前價格</th><th>價差</th><th>漲跌幅</th></tr></thead><tbody id="compareResults"></tbody></table></div>`);showCompare();}
const fieldNames={code:'代碼',name:'名稱',cls:'類別',shares:'股數／餘額',prin:'本金 TWD',avg:'均價',price:'現價',fx:'匯率',note:'備註',lastUp:'更新月份'};
function auditDetails(a){if(!a.changes)return safeText(a.detail||'舊版紀錄');return a.changes.map(c=>{const b=c.before||{},n=c.after||{};return `<b>${safeText(n.code||b.code)} ${safeText(n.name||b.name)}</b><br>`+Object.keys(fieldNames).filter(k=>JSON.stringify(b[k])!==JSON.stringify(n[k])).map(k=>`${fieldNames[k]}：${safeText(b[k]??'—')} → ${safeText(n[k]??'—')}`).join('<br>');}).join('<hr>')+ (a.input?`<br>輸入方式：${safeText(a.input.source)}；股數 ${safeText(a.input.shares??'—')}；成交價 ${safeText(a.input.price??'—')}；金額 ${safeText(a.input.cost??'—')} TWD${a.input.proceeds!=null?`；估計賣出金額 ${safeText(a.input.proceeds)} TWD`:''}`:'');}
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
      else{const shares=numberInput('a_shares');if(shares<=0)throw Error('股數必須大於零');
      if(document.getElementById('tradeDirection').value==='sell'){
        if(shares>r.shares)throw Error('減碼股數不能超過目前持股');
        if(r.prin==null||!Number.isFinite(r.prin))throw Error('請先補上本金，再使用減碼');
        const price=numberInput('a_price',true)??r.price;
        if(!(price>0)||!(r.fx>0))throw Error('請填有效成交價及匯率');
        const removed=r.prin*shares/r.shares;
        input={source:'減碼；本金按原持股比例扣除，非扣除售價',shares,price,cost:-removed,proceeds:shares*price*r.fx};
        recordAction(()=>{r.shares-=shares;r.prin-=removed;r.avg=r.shares>0?r.prin/(r.fx*r.shares):0;save();closeModal();render();},'減碼',input);return;
      }
const fixed=document.getElementById('fgCost').style.display!=='none';const entered=numberInput('a_price',true);const price=entered??r.price;const cost=fixed?numberInput('a_cost'):shares*price*r.fx;if(!(cost>0)||!Number.isFinite(cost)||!(r.fx>0))throw Error('請確認成交價、花費與匯率皆為有效正數');input={source:fixed?'固定投入金額':entered===null?'現價估算':'自行輸入成交價',shares,price:fixed?null:price,cost};}
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
function undoLastTrade(){const a=audit.at(-1);try{const next=PortfolioCore.undo(data,a);if(!confirm('撤銷最近一次操作的修改欄位？其餘部位與後續報價會保留。'))return;const before=clone(data);data=next;a.undone=true;a.undoneAt=new Date().toISOString();audit.push({id:rowId(),createdAt:new Date().toISOString(),at:new Date().toLocaleString('zh-TW'),label:'撤銷：'+a.label,changes:PortfolioCore.changes(before,data),undone:true,undoOf:a.id});save();persistNow();render();document.getElementById('extraDialog')?.close();}catch(e){alert(e.message);}}
const originalRenderTable=renderTable;
renderTable=function(){originalRenderTable();if(!isLive())return;const key=latestBaseline();document.getElementById('hcount').textContent+=key?` · 較 ${fmtLabel(key)}`:' · 尚無快照';document.querySelectorAll('#hbody tr[data-idx]').forEach(tr=>{const r=data[Number(tr.dataset.idx)];const history=document.createElement('button');history.className='mini-btn';history.textContent='◷';history.title='查看此部位操作紀錄';history.setAttribute('aria-label',r.code+' 操作紀錄');history.onclick=e=>{e.stopPropagation();openAudit(r._id);};tr.cells[0].append(history);if(['現金','貸款'].includes(r.cls))return;const c=priceChange(r,key),b=document.createElement('button');b.className='mini-btn';b.style.cssText='display:block;margin-top:5px';b.style.color=c?.delta>0?'#d33':c?.delta<0?'#198754':'inherit';b.textContent=changeLabel(c);b.title=c?`${fmtLabel(key)}：${c.old} → ${c.now}，價差 ${c.delta.toFixed(2)}\n報價取得時間：${r.quoteUpdatedAt?new Date(r.quoteUpdatedAt).toLocaleString('zh-TW'):'尚無紀錄'}`:'該快照無有效價格';b.onclick=e=>{e.stopPropagation();alert(b.title);};tr.cells[0].append(b);});};


// Sell reduces carrying principal proportionally; estimated proceeds are kept in the audit.
const directionBox=document.createElement('div');directionBox.className='fg';directionBox.innerHTML='<label>操作</label><select id="tradeDirection" onchange="updateTradeDirection()"><option value="buy">加碼</option><option value="sell">減碼</option></select>';
document.getElementById('addNormal').prepend(directionBox);
const basePrev=prev;
prev=function(){
  if(editIdx<0||document.getElementById('tradeDirection').value!=='sell'||['現金','貸款'].includes(data[editIdx].cls)){basePrev();return;}
  const r=data[editIdx],n=Number(document.getElementById('a_shares').value),price=Number(document.getElementById('a_price').value||r.price);
  const remaining=r.shares-n,principal=r.shares>0?(r.prin||0)*remaining/r.shares:0;
  document.getElementById('addPrev').innerHTML=`股數：${fmt(r.shares)} → ${fmt(remaining)}<br>本金：${fmt(r.prin)} → ${fmt(principal)} TWD<br>估計賣出金額：${fmt(n*price*(r.fx||1))} TWD<br><small>本金按持股比例扣除；賣出金額僅供核對，未自動加入現金。</small>`;
};
function updateTradeDirection(){const sell=document.getElementById('tradeDirection').value==='sell';document.querySelector('#a_shares').previousElementSibling.textContent=sell?'本次賣出股數':'本次買進股數';if(sell){document.getElementById('fgCost').style.display='none';document.getElementById('fgPrice').style.display='block';}prev();}
const baseOpenEdit=openEdit;
openEdit=function(i){document.getElementById('tradeDirection').value='buy';baseOpenEdit(i);updateTradeDirection();};
