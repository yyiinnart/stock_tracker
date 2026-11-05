/* 配息資料單一來源：YIELD。
   y.d = 全年每股配息（原幣）｜y.months = 發放月份｜y.frequency = 每年發放次數（空白＝月份數）
   y.currency = 幣別｜y.calendarEnabled = 是否顯示於行事曆｜y.actual = {'YYYY-MM': 實際入帳總額（該標的幣別）}
   行事曆、追蹤選單都只讀 YIELD 與庫存(data)，不另存一份；CAL 僅保留作舊版筆記。 */
function incomeKey(code){return String(code||'').trim().toUpperCase();}
function incomeMonths(y){return [...new Set((Array.isArray(y.months)?y.months:[]).filter(m=>Number.isInteger(m)&&m>=1&&m<=12))].sort((a,b)=>a-b);}
function incomeHoldings(y){return data.filter(r=>incomeKey(r.code)===incomeKey(y.c)&&!['現金','貸款'].includes(r.cls));}
function incomeShares(y){return incomeHoldings(y).reduce((sum,r)=>sum+(Number(r.shares)||0),0);}
function incomeCurrency(y){return y.currency||(incomeHoldings(y).some(r=>r.cls==='美股')?'USD':'TWD');}
function incomeEdit(i){document.getElementById('extraDialog')?.close();openYieldEdit(i);}
function incomeFrequency(y){return Number(y.frequency)>0?Number(y.frequency):incomeMonths(y).length;}
function incomeAmount(y){const f=incomeFrequency(y);return y.d==null||y.d===''||!Number.isFinite(Number(y.d))||!f?null:Number(y.d)*incomeShares(y)/f;}
function incomeTracked(code){return YIELD.some(y=>incomeKey(y.c)===incomeKey(code));}
const INCOME_SYMBOL={TWD:'NT$',USD:'US$'};
function incomeNum(currency,value){return Number(value).toLocaleString('zh-TW',currency==='TWD'?{maximumFractionDigits:0}:{minimumFractionDigits:2,maximumFractionDigits:2});}
function incomeMoney(currency,value){return safeText(currency)+' '+incomeNum(currency,value);}
function incomeShort(currency,value){return (INCOME_SYMBOL[currency]||safeText(currency)+' ')+incomeNum(currency,value);}
function incomeTotals(map){const e=Object.entries(map).sort(([a],[b])=>(a==='TWD'?-1:b==='TWD'?1:a.localeCompare(b)));return e.map(([c,v])=>incomeMoney(c,v)).join(' / ');}
function incomeActualKey(month){return new Date().getFullYear()+'-'+String(month).padStart(2,'0');}
function incomeActual(y,month){const v=y.actual&&typeof y.actual==='object'?y.actual[incomeActualKey(month)]:null;return v==null||v===''||!Number.isFinite(Number(v))?null:Number(v);}
function incomeRows(month){return YIELD.map((y,index)=>({y,index})).filter(({y})=>!y.trackingHidden&&y.calendarEnabled!==false&&incomeMonths(y).includes(month));}
function incomeMonthModel(month){
 const rows=incomeRows(month).map(({y,index})=>({y,index,cur:incomeCurrency(y),shares:incomeShares(y),est:incomeAmount(y),act:incomeActual(y,month)}));
 rows.forEach(r=>{if(r.shares<=0)r.est=null;});
 rows.sort((a,b)=>(a.cur===b.cur?0:a.cur==='TWD'?-1:b.cur==='TWD'?1:a.cur.localeCompare(b.cur))||((b.est??-1)-(a.est??-1)));
 const est={},act={};let unknown=0,received=0;
 rows.forEach(r=>{if(r.est===null&&r.shares>0)unknown++;if(r.est!==null)est[r.cur]=(est[r.cur]||0)+r.est;if(r.act!==null){act[r.cur]=(act[r.cur]||0)+r.act;received++;}});
 return {rows,est,act,unknown,received};
}
function incomeRefresh(){save();persistNow();renderYield();renderCal();}

/* ── 每月 ⋯ 管理：統一處理該月份的項目 ── */
function removeIncomeMonth(i,month){const y=YIELD[i];if(!y||!confirm('只把 '+y.c+' 移出 '+month+' 月？\n其他月份、年配息與追蹤都保留；單次估算金額不變。'))return;y.frequency=incomeFrequency(y);y.months=incomeMonths(y).filter(m=>m!==month);incomeRefresh();manageIncomeMonth(month);}
function cancelIncomeTracking(i,month){const y=YIELD[i];if(!y)return;y.trackingHidden=true;incomeRefresh();manageIncomeMonth(month);}
function deleteIncomeTracking(i,month){const y=YIELD[i];if(!y||!confirm('刪除 '+y.c+' 的全部配息設定與入帳紀錄？此操作無法復原，庫存不受影響。'))return;YIELD.splice(i,1);incomeRefresh();if(month)manageIncomeMonth(month);else openIncomeImport();}
function incomeTrackingMenu(i){return actionMenu(YIELD[i].c+'配息操作',`<button onclick="incomeEdit(${i})">編輯設定</button><button class="btn danger" onclick="deleteIncomeTracking(${i})">刪除配息設定</button>`);}
function saveIncomeActual(i,month){
 const y=YIELD[i],el=document.getElementById('incomeActual'+i);if(!y||!el)return;const t=el.value.trim();
 if(t!==''&&(!Number.isFinite(Number(t))||Number(t)<0)){alert('實際入帳請填零或正數。');return;}
 const key=incomeActualKey(month);y.actual=y.actual&&typeof y.actual==='object'?y.actual:{};
 if(t==='')delete y.actual[key];else y.actual[key]=Number(t);
 if(!Object.keys(y.actual).length)delete y.actual;
 incomeRefresh();manageIncomeMonth(month);
}
function addIncomeMonth(month){
 const y=YIELD[Number(document.getElementById('incomeAddSel')?.value)];if(!y)return;
 const months=[...new Set([...incomeMonths(y),month])].sort((a,b)=>a-b);
 y.frequency=Math.max(incomeFrequency(y),months.length);y.months=months;y.calendarEnabled=true;y.trackingHidden=false;
 incomeRefresh();manageIncomeMonth(month);
}
function manageIncomeMonth(month){
 const model=incomeMonthModel(month),year=new Date().getFullYear();
 const addable=YIELD.map((y,i)=>({y,i})).filter(({y})=>!incomeMonths(y).includes(month)||y.trackingHidden||y.calendarEnabled===false);
 const row=r=>`<div class="income-manage-row"><div class="im-main"><strong>${safeText(r.y.c)}</strong> ${safeText(r.y.n)}<span class="muted"> · ${numberText(r.shares)} 股 · ${r.est===null?'—':'預估 '+incomeShort(r.cur,r.est)}</span>${actionMenu(r.y.c+'本月配息操作',`<button onclick="saveIncomeActual(${r.index},${month})">記錄實際入帳</button><button onclick="incomeEdit(${r.index})">編輯設定</button><button onclick="removeIncomeMonth(${r.index},${month})">只移出本月</button><button onclick="cancelIncomeTracking(${r.index},${month})">隱藏追蹤</button><button class="btn danger" onclick="deleteIncomeTracking(${r.index},${month})">刪除配息設定</button>`)}</div><div class="im-actual"><label for="incomeActual${r.index}">${year} 年 ${month} 月實際入帳（${safeText(r.cur)}）</label><input id="incomeActual${r.index}" type="number" min="0" step="any" value="${r.act===null?'':r.act}" placeholder="${r.est===null?'':Math.round(r.est*100)/100}"></div></div>`;
 openExtra(month+'月配息管理',`<p class="muted">配息資料統一在殖利率追蹤維護。「只移出本月」保留追蹤、其他月份與入帳紀錄；「隱藏追蹤」保留全部設定；「刪除配息設定」會刪除該標的全部配息設定。實際入帳選填，與預估分開顯示。</p><div class="income-manage">${model.rows.map(row).join('')||'<p class="muted">本月沒有標的。可從下方加入已追蹤的標的。</p>'}</div>${addable.length?`<div class="income-add"><select id="incomeAddSel" aria-label="加入本月的標的">${addable.map(({y,i})=>`<option value="${i}">${safeText(y.c)} ${safeText(y.n)}</option>`).join('')}</select><button class="text-btn" onclick="addIncomeMonth(${month})">加入 ${month} 月</button></div>`:''}`);
}

/* ── 行事曆（緊湊版）── */
renderCal=function(){
 const now=new Date().getMonth()+1,yearEst={},yearAct={};
 document.getElementById('cal').innerHTML=Array.from({length:12},(_,i)=>{
  const month=i+1,m=incomeMonthModel(month);
  Object.entries(m.est).forEach(([c,v])=>{yearEst[c]=(yearEst[c]||0)+v;});Object.entries(m.act).forEach(([c,v])=>{yearAct[c]=(yearAct[c]||0)+v;});
  const entries=m.rows.map(r=>{
   const value=r.act!==null?`<i class="income-badge" title="已記錄實際入帳">實</i>${incomeShort(r.cur,r.act)}`:r.shares<=0?'<span class="income-status" title="目前無庫存，未計入預估">無庫存</span>':r.est===null?'<span class="income-status" title="請設定全年配息與發放次數">未設定</span>':incomeShort(r.cur,r.est);
   const tip=`${r.y.n||''} · 庫存 ${numberText(r.shares)} 股`+(r.est===null?'':` · 預估 ${incomeShort(r.cur,r.est)}（年配息 ${numberText(r.y.d)} ÷ ${incomeFrequency(r.y)} 次）`);
   return `<li class="income-entry${r.act!==null?' is-actual':''}" title="${safeText(tip)}"><span class="income-code">${safeText(r.y.c)}</span><span class="income-name">${safeText(r.y.n)}</span><span class="income-value">${value}</span></li>`;}).join('');
  return `<section class="cal-m ${month===now?'now':''}"><div class="income-month-head"><div class="mo">${month}月${month===now?'<span class="n">本月</span>':''}</div>${actionMenu(month+'月配息操作',`<button onclick="manageIncomeMonth(${month})">管理本月配息</button>`)}</div><div class="income-total">${Object.entries(m.est).map(([cur,value])=>`<div><small>預估 ${safeText(cur)}</small> <strong>${incomeNum(cur,value)}</strong></div>`).join('')||'<small>預估</small> —'}</div>${m.received?`<div class="income-actual">實際 ${incomeTotals(m.act)}（${m.received}/${m.rows.length} 檔）</div>`:''}${m.unknown?`<small class="income-warning" title="未設定年配息的標的不計入預估總額">${m.unknown} 檔待設定</small>`:''}${entries?`<ul class="income-list">${entries}</ul>`:'<div class="income-empty" title="尚未安排本月發放標的">—</div>'}</section>`;
 }).join('');
 const summary=document.getElementById('incomeSummary');
 if(summary)summary.innerHTML=`<span><b>全年預估</b> ${incomeTotals(yearEst)||'—'}</span>${Object.keys(yearAct).length?`<span><b>已記錄實際</b> ${incomeTotals(yearAct)}</span>`:''}<span class="muted">估算值，各幣別分開，不含未設定年配息的標的</span>`;
 const missing=YIELD.map((y,i)=>({y,i})).filter(({y})=>!y.trackingHidden&&y.calendarEnabled!==false&&(!incomeMonths(y).length||incomeFrequency(y)!==incomeMonths(y).length));
 const hidden=YIELD.map((y,i)=>({y,i})).filter(({y})=>!y.trackingHidden&&y.calendarEnabled===false);
 const chips=list=>list.map(({y,i})=>`<button class="text-btn" onclick="incomeEdit(${i})">${safeText(y.c)}</button>`).join('');
 document.getElementById('incomeUnscheduled').innerHTML=(missing.length?'<p class="muted"><span title="未分配的月份不計入行事曆預估">待排月份</span>：'+chips(missing)+'</p>':'')+(hidden.length?'<p class="muted"><span title="設定保留；可在配息設定中恢復顯示">已隱藏</span>：'+chips(hidden)+'</p>':'');
 document.getElementById('legacyCalendar').hidden=!CAL.length;
 document.getElementById('legacyCalendarText').textContent=CAL.map(c=>`${c.m}：${String(c.e??'').replace(/<br\s*\/?\s*>/gi,'、').replace(/<[^>]*>/g,'')}`).join('\n');
};

/* ── 編輯視窗：全年配息、頻率、月份、單次估算預覽 ── */
function incomePreview(){
 const el=document.getElementById('incomePreview');if(!el)return;
 const text=document.getElementById('y_d').value.trim(),d=Number(text),count=document.querySelectorAll('.income-months input:checked').length;
 const ft=document.getElementById('incomeFrequency').value.trim(),f=Number(ft)>0?Number(ft):count,cur=document.getElementById('incomeCurrency').value;
 const code=incomeKey(document.getElementById('y_code').value),shares=data.filter(r=>incomeKey(r.code)===code&&!['現金','貸款'].includes(r.cls)).reduce((s,r)=>s+(Number(r.shares)||0),0);
 el.textContent=!text||!Number.isFinite(d)||!f?'填入全年每股配息與發放月份後，這裡會顯示單次估算，可確認欄位是全年而非單次。':`單次每股約 ${numberText(d/f)}（${numberText(d)} ÷ ${f} 次）；目前庫存 ${numberText(shares)} 股，單次約 ${incomeMoney(cur,d/f*shares)}、全年約 ${incomeMoney(cur,d*shares)}。`;
}
const incomeOriginalOpen=openYieldEdit;
openYieldEdit=function(i){
  incomeOriginalOpen(i);const y=YIELD[i]||{},months=incomeMonths(y);
  document.getElementById('incomeEditor').innerHTML=`<div class="fg"><label for="incomeCurrency">配息幣別</label><select id="incomeCurrency"><option value="TWD">TWD 台幣</option><option value="USD">USD 美元</option></select></div><div class="fg"><label for="incomeFrequency">每年發放次數</label><input id="incomeFrequency" type="number" min="1" max="12" step="1" value="${incomeFrequency(y)||''}" placeholder="未填時依勾選月份數"><div class="hint">單次每股 = 全年每股配息 ÷ 年發放次數；再乘以目前股數。各次平均估算，非實際入帳。</div></div><fieldset class="income-months"><legend>發放月份（可複選）</legend>${Array.from({length:12},(_,m)=>`<label><input type="checkbox" value="${m+1}" ${months.includes(m+1)?'checked':''}>${m+1}月</label>`).join('')}</fieldset><div class="hint" id="incomePreview"></div><label class="income-toggle"><input id="incomeEnabled" type="checkbox" ${y.calendarEnabled!==false?'checked':''}>顯示於配息行事曆</label><div class="fg"><label for="incomeNote">配息備註</label><textarea id="incomeNote" rows="2">${safeText(y.incomeNote||'')}</textarea></div><p class="muted" id="incomeProvenance">${safeText(y.dividendBasis||'手動維護；建議使用近12個月已發放每股現金配息。')}${y.dividendAsOf?' · 資料截至 '+safeText(y.dividendAsOf):''}</p>`;
  document.getElementById('incomeCurrency').value=incomeCurrency(y);
  if(y.dividendSource&&/^https:\/\//.test(y.dividendSource)){const a=document.createElement('a');a.href=y.dividendSource;a.target='_blank';a.rel='noopener noreferrer';a.textContent=' 查詢來源';document.getElementById('incomeProvenance').append(a);}
  document.getElementById('yldDelBtn').textContent='刪除配息設定';
  ['y_d','y_code'].forEach(id=>{document.getElementById(id).oninput=incomePreview;});
  const editor=document.getElementById('incomeEditor');editor.oninput=incomePreview;editor.onchange=incomePreview;incomePreview();
};
const incomeOriginalSave=yldSave;
yldSave=function(){
  const code=document.getElementById('y_code').value.trim();if(!code){alert('請填代碼');return;}
  if(YIELD.some((y,i)=>i!==yldEditIdx&&incomeKey(y.c)===incomeKey(code))){alert('此代碼已在殖利率追蹤，請編輯原有標的。');return;}
  for(const id of ['y_d','y_p','y_cost','y_y']){const v=document.getElementById(id).value.trim();if(v&&(!Number.isFinite(Number(v))||Number(v)<0)){alert('配息、股價與殖利率請填入零或正數。');return;}}
  const frequencyText=document.getElementById('incomeFrequency').value.trim(),frequency=Number(frequencyText);
  const count=document.querySelectorAll('.income-months input:checked').length;
  if(frequencyText&&(!Number.isInteger(frequency)||frequency<1||frequency>12||frequency<count)){alert('年發放次數須為 1 至 12，且不可少於已選月份數。');return;}
  const old=YIELD[yldEditIdx],index=yldEditIdx<0?YIELD.length:yldEditIdx;
  const changed=!old||old.d!==Number(document.getElementById('y_d').value)||old.c!==code;
  const fields={frequency:frequencyText?frequency:(count||null),months:[...document.querySelectorAll('.income-months input:checked')].map(el=>Number(el.value)),calendarEnabled:document.getElementById('incomeEnabled').checked,currency:document.getElementById('incomeCurrency').value,incomeNote:document.getElementById('incomeNote').value.trim()};
  incomeOriginalSave();const y=YIELD[index];if(!y)return;Object.assign(y,fields);
  if(changed){y.dividendBasis='手動維護';y.dividendAsOf=localToday();delete y.dividendSource;}
  incomeRefresh();
};
const incomeOriginalDelete=yldDel;
yldDel=function(){incomeOriginalDelete();incomeRefresh();};
const incomeOriginalRenderYield=renderYield;
renderYield=function(){incomeOriginalRenderYield();document.querySelectorAll('#ybody tr').forEach((tr,i)=>{
  const y=YIELD[Number(tr.dataset.yieldIndex)];if(!y)return;const sub=document.createElement('small');sub.className='income-summary';sub.textContent=incomeCurrency(y)+' · '+(y.calendarEnabled===false?'已移出行事曆':incomeMonths(y).length?'發放 '+incomeMonths(y).join('、')+' 月':'待設定月份');tr.cells[0].append(sub);
  const button=tr.querySelector('button');if(button)button.outerHTML=incomeTrackingMenu(Number(tr.dataset.yieldIndex));
});};

/* ── 從庫存加入追蹤：勾選控制顯示狀態；取消勾選保留 YIELD 配息資料 ── */
function openIncomeImport(){
  const held=[...new Map(data.filter(r=>!['現金','貸款'].includes(r.cls)&&Number(r.shares)>0).map(r=>[incomeKey(r.code),r])).values()];
  const heldKeys=new Set(held.map(r=>incomeKey(r.code)));
  const tags=y=>[y.calendarEnabled===false?'未顯示於行事曆':'',y&&(y.d==null||y.d==='')?'未設定年配息':'',!y||incomeMonths(y).length?'':'未設定月份'].filter(Boolean).join(' · ');
  const line=(code,name,note,tracked)=>`<label><input type="checkbox" data-code="${safeText(code)}" ${tracked?'checked':''} onchange="toggleIncomeTracking(this)"><span>${safeText(code)} ${safeText(name)}${note?` <span class="im-tag">· ${safeText(note)}</span>`:''}</span></label>${YIELD.some(y=>incomeKey(y.c)===incomeKey(code))?incomeTrackingMenu(YIELD.findIndex(y=>incomeKey(y.c)===incomeKey(code))):''}`;
  const heldHtml=held.map(r=>{const y=YIELD.find(y=>incomeKey(y.c)===incomeKey(r.code));return line(r.code,r.name,y?tags(y):'',!!y&&!y.trackingHidden);}).join('');
  const extraHtml=YIELD.filter(y=>!heldKeys.has(incomeKey(y.c))).map(y=>line(y.c,y.n,'目前無庫存'+(tags(y)?' · '+tags(y):''),!y.trackingHidden)).join('');
  openExtra('從庫存加入配息追蹤',`<p class="muted">勾選顯示標的；取消勾選只隱藏，所有配息設定與入帳紀錄均保留。重新勾選即可恢復；刪除請使用「編輯設定」內的刪除按鈕。</p><div class="income-import-list">${heldHtml||'<p>目前沒有可加入的庫存。</p>'}${extraHtml?`<h4 class="im-sub">已追蹤但目前無庫存</h4>${extraHtml}`:''}</div><button class="btn" type="button" onclick="document.getElementById('extraDialog').close()">完成</button>`);
}
function toggleIncomeTracking(el){
  const code=el.dataset.code,index=YIELD.findIndex(y=>incomeKey(y.c)===incomeKey(code));
  if(el.checked){
    if(index>=0)YIELD[index].trackingHidden=false;
    if(index<0){const r=data.find(r=>incomeKey(r.code)===incomeKey(code)&&!['現金','貸款'].includes(r.cls));if(r)YIELD.push({c:r.code,n:r.name,p:r.price,d:null,y:null,cost:null,g:null,currency:r.cls==='美股'?'USD':'TWD',months:[],calendarEnabled:true,dividendBasis:'手動維護'});}
  }else if(index>=0){
    YIELD[index].trackingHidden=true;
  }
  const top=document.querySelector('.income-import-list')?.scrollTop||0;
  incomeRefresh();openIncomeImport();
  const box=document.querySelector('.income-import-list');if(box)box.scrollTop=top;
}
// Inline annual-dividend edits also invalidate the historical calculation label.
const incomeOriginalFinish=setDiv;
setDiv=function(...args){if(String(args[1]).trim()!==''&&(!Number.isFinite(Number(args[1]))||Number(args[1])<0)){alert('請填入有效的非負年配息');renderYield();return;}const before=YIELD.map(y=>y.d);incomeOriginalFinish(...args);YIELD.forEach((y,i)=>{if(y.d!==before[i]){y.dividendBasis='手動維護';y.dividendAsOf=localToday();delete y.dividendSource;}});if(String(args[1]).trim()===''){YIELD[args[0]].y=null;YIELD[args[0]].cost=null;}save();renderYield();renderCal();};
renderYield();renderCal();

// 股數、追蹤清單或匯入／雲端資料變動時，行事曆立即重算。
window.addEventListener('portfoliochange',()=>{renderCal();});
