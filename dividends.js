/* Manual income settings live on YIELD; CAL is retained only as legacy notes. */
function incomeMonths(y){return [...new Set((Array.isArray(y.months)?y.months:[]).filter(m=>Number.isInteger(m)&&m>=1&&m<=12))].sort((a,b)=>a-b);}
function incomeHoldings(y){return data.filter(r=>r.code===y.c&&!['現金','貸款'].includes(r.cls));}
function incomeShares(y){return incomeHoldings(y).reduce((sum,r)=>sum+(Number(r.shares)||0),0);}
function incomeCurrency(y){return y.currency||(incomeHoldings(y).some(r=>r.cls==='美股')?'USD':'TWD');}
function incomeEdit(i){document.getElementById('extraDialog')?.close();openYieldEdit(i);}
function removeFromCalendar(i){if(!YIELD[i]||!confirm('將 '+YIELD[i].c+' 移出行事曆？殖利率追蹤和庫存會保留。'))return;YIELD[i].calendarEnabled=false;save();persistNow();renderYield();renderCal();}
renderCal=function(){
  const now=new Date().getMonth()+1;
  document.getElementById('cal').innerHTML=Array.from({length:12},(_,i)=>{
    const month=i+1,rows=YIELD.map((y,index)=>({y,index})).filter(({y})=>y.calendarEnabled!==false&&incomeMonths(y).includes(month));
    return `<section class="cal-m ${month===now?'now':''}"><div class="mo">${month}月${month===now?'<span class="n">本月</span>':''}</div>${rows.length?rows.map(({y,index})=>`<div class="income-entry"><button class="income-name" onclick="incomeEdit(${index})" aria-label="編輯 ${safeText(y.c)} 配息"><strong>${safeText(y.c)}</strong><span>${safeText(y.n)}</span></button><small>${incomeShares(y)>0?'庫存 '+numberText(incomeShares(y))+' 股':'無庫存 · 追蹤中'}</small><button class="income-remove" onclick="removeFromCalendar(${index})" aria-label="將 ${safeText(y.c)} 移出行事曆" title="移出行事曆">×</button></div>`).join(''):'<div class="income-empty">未設定標的</div>'}</section>`;
  }).join('');
  const missing=YIELD.map((y,i)=>({y,i})).filter(({y})=>y.calendarEnabled!==false&&!incomeMonths(y).length);
  document.getElementById('incomeUnscheduled').innerHTML=missing.length?'<p class="muted">待設定發放月份：'+missing.map(({y,i})=>`<button class="text-btn" onclick="incomeEdit(${i})">${safeText(y.c)}</button>`).join('')+'</p>':'';
  const legacy=document.getElementById('legacyCalendar');legacy.hidden=!CAL.length;
  document.getElementById('legacyCalendarText').textContent=CAL.map(c=>`${c.m}：${String(c.e??'').replace(/<br\s*\/?\s*>/gi,'、').replace(/<[^>]*>/g,'')}`).join('\n');
};
const incomeOriginalOpen=openYieldEdit;
openYieldEdit=function(i){
  incomeOriginalOpen(i);const y=YIELD[i]||{},months=incomeMonths(y);
  document.getElementById('incomeEditor').innerHTML=`<div class="fg"><label for="incomeCurrency">配息幣別</label><select id="incomeCurrency"><option value="TWD">TWD 台幣</option><option value="USD">USD 美元</option></select></div><fieldset class="income-months"><legend>發放月份（可複選）</legend>${Array.from({length:12},(_,m)=>`<label><input type="checkbox" value="${m+1}" ${months.includes(m+1)?'checked':''}>${m+1}月</label>`).join('')}</fieldset><label class="income-toggle"><input id="incomeEnabled" type="checkbox" ${y.calendarEnabled!==false?'checked':''}>顯示於配息行事曆</label><div class="fg"><label for="incomeNote">配息備註</label><textarea id="incomeNote" rows="2">${safeText(y.incomeNote||'')}</textarea></div><p class="muted" id="incomeProvenance">${safeText(y.dividendBasis||'手動維護；建議使用近12個月已發放每股現金配息。')}${y.dividendAsOf?' · 資料截至 '+safeText(y.dividendAsOf):''}</p>`;
  document.getElementById('incomeCurrency').value=incomeCurrency(y);
  if(y.dividendSource&&/^https:\/\//.test(y.dividendSource)){const a=document.createElement('a');a.href=y.dividendSource;a.target='_blank';a.rel='noopener noreferrer';a.textContent=' 查詢來源';document.getElementById('incomeProvenance').append(a);}
  document.getElementById('yldDelBtn').textContent='刪除標的';
};
const incomeOriginalSave=yldSave;
yldSave=function(){
  const code=document.getElementById('y_code').value.trim();if(!code){alert('請填代碼');return;}
  if(YIELD.some((y,i)=>i!==yldEditIdx&&y.c.toUpperCase()===code.toUpperCase())){alert('此代碼已在殖利率追蹤，請編輯原有標的。');return;}
  for(const id of ['y_d','y_p','y_cost','y_y']){const v=document.getElementById(id).value.trim();if(v&&(!Number.isFinite(Number(v))||Number(v)<0)){alert('配息、股價與殖利率請填入零或正數。');return;}}
  const old=YIELD[yldEditIdx],index=yldEditIdx<0?YIELD.length:yldEditIdx;
  const changed=!old||old.d!==Number(document.getElementById('y_d').value)||old.c!==code;
  const fields={months:[...document.querySelectorAll('.income-months input:checked')].map(el=>Number(el.value)),calendarEnabled:document.getElementById('incomeEnabled').checked,currency:document.getElementById('incomeCurrency').value,incomeNote:document.getElementById('incomeNote').value.trim()};
  incomeOriginalSave();const y=YIELD[index];if(!y)return;Object.assign(y,fields);
  if(changed){y.dividendBasis='手動維護';y.dividendAsOf=localToday();delete y.dividendSource;}
  save();persistNow();renderYield();renderCal();
};
const incomeOriginalDelete=yldDel;
yldDel=function(){incomeOriginalDelete();persistNow();renderCal();};
const incomeOriginalRenderYield=renderYield;
renderYield=function(){incomeOriginalRenderYield();document.querySelectorAll('#ybody tr').forEach((tr,i)=>{
  const y=YIELD[i];if(!y)return;const sub=document.createElement('small');sub.className='income-summary';sub.textContent=incomeCurrency(y)+' · '+(y.calendarEnabled===false?'已移出行事曆':incomeMonths(y).length?'發放 '+incomeMonths(y).join('、')+' 月':'待設定月份');tr.cells[0].append(sub);
  const button=tr.querySelector('button');if(button){button.className='income-edit';button.textContent='編輯';button.setAttribute('aria-label','編輯 '+y.c);}
});};
function openIncomeImport(){
  const rows=[...new Map(data.filter(r=>!['現金','貸款'].includes(r.cls)&&Number(r.shares)>0).map(r=>[r.code,r])).values()];
  openExtra('從庫存加入配息追蹤',`<p>帶入名稱、股價與幣別；年配息及發放月份由你設定。已存在的標的不會重複新增。</p><form id="incomeImportForm" onsubmit="event.preventDefault();importIncomeHoldings()"><div class="income-import-list">${rows.map((r,i)=>{const exists=YIELD.some(y=>y.c===r.code);return `<label><input type="checkbox" name="incomePosition" value="${safeText(r.code)}" ${exists?'disabled':'checked'}><span>${safeText(r.code)} ${safeText(r.name)}${exists?' · 已加入':''}</span></label>`;}).join('')||'<p>目前沒有可加入的庫存。</p>'}</div><button class="btn" type="submit">加入勾選標的</button></form>`);
}
function importIncomeHoldings(){
  const codes=[...document.querySelectorAll('[name="incomePosition"]:checked')].map(el=>el.value);
  for(const code of codes){if(YIELD.some(y=>y.c===code))continue;const r=data.find(r=>r.code===code&&!['現金','貸款'].includes(r.cls));if(!r)continue;YIELD.push({c:r.code,n:r.name,p:r.price,d:null,y:null,cost:null,g:null,currency:r.cls==='美股'?'USD':'TWD',months:[],calendarEnabled:true,dividendBasis:'手動維護'});}
  save();persistNow();renderYield();renderCal();document.getElementById('extraDialog').close();
}
// Inline annual-dividend edits also invalidate the historical calculation label.
const incomeOriginalFinish=setDiv;
setDiv=function(...args){if(String(args[1]).trim()!==''&&(!Number.isFinite(Number(args[1]))||Number(args[1])<0)){alert('請填入有效的非負年配息');renderYield();return;}const before=YIELD.map(y=>y.d);incomeOriginalFinish(...args);YIELD.forEach((y,i)=>{if(y.d!==before[i]){y.dividendBasis='手動維護';y.dividendAsOf=localToday();delete y.dividendSource;}});if(String(args[1]).trim()===''){YIELD[args[0]].y=null;YIELD[args[0]].cost=null;}save();renderYield();renderCal();};
renderYield();renderCal();
