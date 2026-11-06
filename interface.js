/* Workspace navigation, responsive data views and guided setup. */
let analysisSection='compare',setupChoice='new';
const pageNames={hold:'我的持倉',analy:'比較與分析',records:'操作紀錄',plans:'投資計畫',settings:'設定'};
function setTab(t){
  if(!pageNames[t])t='hold';tab=t;
  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('on',p.id==='page-'+t));
  document.querySelectorAll('.app-nav button').forEach(b=>{if(b.dataset.page===t)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  document.getElementById('pageTitle').textContent=pageNames[t];
  document.getElementById('histBanner').classList.toggle('show',!isLive()&&(t==='hold'||t==='analy'));
  if(t==='analy'){showAnalysis(analysisSection);refreshAiPreview();}
  if(t==='records')renderAuditPage();
  if(t==='settings')renderSettings();
  if(t==='plans'){if(!isLive())switchView('live');document.getElementById('dcaCard').style.display='';document.getElementById('recurringCard').style.display='';}
  window.scrollTo({top:0,behavior:'instant'});
}
function showAnalysis(name){
  analysisSection=name;
  for(const [key,id] of Object.entries({compare:'comparisonPanel',charts:'analysisCharts',income:'analysisIncome'}))document.getElementById(id).hidden=key!==name;
  document.querySelectorAll('[data-analysis]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.analysis===name)));
  if(name==='compare')refreshComparison();
  if(name==='charts'&&typeof Chart!=='undefined')requestAnimationFrame(()=>renderCharts());
}
function focusSetting(id){setTab('settings');const el=document.getElementById(id);el.scrollIntoView({block:'start',behavior:'instant'});el.focus({preventScroll:true});}
openCloud=function(){focusSetting('cloudPanel');};
openCompare=function(){analysisSection='compare';setTab('analy');};
function refreshComparison(){
  const select=document.getElementById('compareDate'),previous=select.value;
  const keys=archLabels().filter(k=>/^\d{6}$/.test(k)).reverse();
  select.innerHTML=keys.length?keys.map(k=>`<option value="${k}">${fmtLabel(k)}</option>`).join(''):'<option value="">尚無快照</option>';
  if(keys.includes(previous))select.value=previous;
  select.disabled=!keys.length;showCompare();
}
showCompare=function(){
  const key=document.getElementById('compareDate').value,direction=document.getElementById('compareDirection').value;
  const empty=document.getElementById('compareEmpty');empty.hidden=!!key;
  document.querySelectorAll('[data-direction]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.direction===direction)));
  const sort=document.getElementById('compareSort').value;
  const rows=data.filter(r=>!['現金','貸款'].includes(r.cls)).map(r=>{const c=priceChange(r,key);return {r,c,pnl:comparisonPnl(r,c)};}).filter(x=>direction==='all'||x.c&&(direction==='up'?x.c.delta>0:x.c.delta<0)).sort((a,b)=>{const av=sort.startsWith('rate')?a.c?.rate:a.pnl,bv=sort.startsWith('rate')?b.c?.rate:b.pnl;if(av==null)return bv==null?0:1;if(bv==null)return -1;return sort.endsWith('Asc')?av-bv:bv-av;});
  document.getElementById('compareResults').innerHTML=!key?'':!rows.length?'<p class="empty-note">無符合資料</p>':`<div class="compare-heading"><span>標的</span><span>快照價</span><span>現價</span>${compareSortHeading('rate','漲跌幅',sort)}${compareSortHeading('pnl','台幣相對損益',sort)}</div>`+rows.map(({r,c,pnl})=>`<article class="compare-row" style="--category:${CLR[r.cls]||'#c9ced8'}"><div class="compare-identity"><strong>${safeText(r.name)}</strong><small>${safeText(r.code)} · ${r.fx>1.5?'USD':'TWD'}</small></div><div class="old"><span class="label">${fmtLabel(key)}</span>${c?numberText(c.old):'—'}</div><div class="now"><span class="label">目前價格</span>${numberText(r.price)}</div><div class="delta ${c?.delta>0?'pos':c?.delta<0?'neg':''}">${changeLabel(c)}<small>${c?'價差 '+signedNumber(c.delta):'該快照沒有有效價格'}</small></div><div class="comparison-pnl ${pnl>0?'pos':pnl<0?'neg':''}"><span class="label">台幣相對損益</span>${pnl==null?'—':signedNumber(Math.round(pnl))+' 元'}<small>庫存 ${numberText(r.shares)} 股 · 匯率 ${numberText(r.fx)}</small></div></article>`).join('');
};
function numberText(value){return value==null||!Number.isFinite(Number(value))?'—':Number(value).toLocaleString('zh-TW',{maximumFractionDigits:4});}
function signedNumber(value){return (value>0?'+':'')+numberText(Math.round(value*10000)/10000);}
renderKPI=function(){const t=totals(curData());document.getElementById('kpis').innerHTML=`<div class="kpi"><div class="lbl">淨資產 · TWD</div><div class="val">${fmt(t.total)}</div><div class="delta">含現金，已扣除貸款</div></div><div class="kpi"><div class="lbl">未實現損益</div><div class="val ${t.pl>0?'pos':t.pl<0?'neg':''}">${signedNumber(t.pl)}</div><div class="delta">相對投入本金，不含息</div></div><div class="kpi"><div class="lbl">投入本金 · TWD</div><div class="val">${fmt(t.prin)}</div><div class="delta">投資部位，不含現金</div></div>`;};
renderTable=function(){
  originalRenderTable();const arr=curData(),key=latestBaseline();
  document.getElementById('hcount').textContent=`${arr.filter(r=>filter==='全部'||r.cls===filter).length} 檔${isLive()?(key?' · 較 '+fmtLabel(key):' · 尚無快照'):' · 歷史唯讀'}`;
  document.getElementById('quoteStamp').textContent=isLive()?(quoteUpdatedAt?'報價取得 '+new Date(quoteUpdatedAt).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'}):'報價時間尚無紀錄'):'快照日期 '+fmtLabel(viewKey);
  document.getElementById('addPositionBtn').disabled=!isLive();
  document.getElementById('archiveBtn').disabled=!isLive();document.getElementById('reorderBtn').disabled=!isLive();
  document.querySelectorAll('#hbody tr[data-idx]').forEach(tr=>{
    const i=Number(tr.dataset.idx),r=arr[i],simple=['現金','貸款'].includes(r.cls),c=isLive()&&!simple?priceChange(r,key):null;
    tr.style.setProperty('--category',CLR[r.cls]||'#c9ced8');tr.removeAttribute('onclick');tr.classList.remove('clickable');
    tr.cells[0].innerHTML=`<button class="position-name" onclick="showPosition(${i})" aria-label="${safeText(r.code)} 詳情"><span class="code">${safeText(r.name||r.code)}</span><small><span class="position-code">${safeText(r.code)}</span><span class="category-label">${safeText(r.cls)}</span></small></button>${isLive()?`<div class="position-actions">${simple?iconAction('edit','更新餘額',`openEdit(${i})`):iconAction('plus','加碼',`openTrade(${i},'buy')`)+iconAction('minus','減碼',`openTrade(${i},'sell')`)}${iconAction('more','更多操作',`positionMore(${i})`)}</div>`:''}`;

    tr.cells[3].innerHTML=simple?'<span class="price-unit">'+safeText(r.cls)+'</span>':`<span class="cell-label">現價 · ${r.fx>1.5?'USD':'TWD'}</span><span class="price-main">${numberText(r.price)}</span>${isLive()?`<span class="price-change ${c?.delta>0?'pos':c?.delta<0?'neg':''}">${changeLabel(c)}</span>`:''}`;
    tr.cells[4].insertAdjacentHTML('afterbegin',`<span class="cell-label">${r.cls==='貸款'?'剩餘欠款':'市值'} · TWD</span>`);
    tr.cells[8].insertAdjacentHTML('afterbegin','<span class="cell-label">相對成本損益</span>');
    const profit=pnl(r);if(profit==null||profit===0){tr.cells[8].className='';tr.cells[9].className='';}
    if(reorderMode&&isLive()){tr.cells[0].insertAdjacentHTML('afterbegin','<span class="drag-handle" title="拖曳排列" aria-label="拖曳排列">↕</span>');}
  });
  if(!arr.length){document.getElementById('hbody').innerHTML='<tr><td colspan="10"><div class="empty-note">從第一筆持倉開始，或還原你已有的資料。<div class="empty-actions"><button class="btn primary" onclick="openAdd()">新增第一筆</button><button class="btn" onclick="focusSetting(\'backupPanel\')">還原備份</button></div></div></td></tr>';}
  if(tab==='records')renderAuditPage();
  if(tab==='analy'&&analysisSection==='compare')refreshComparison();
};
function showPosition(i){const r=curData()[i];if(!r)return;const c=priceChange(r,latestBaseline());openExtra(r.code+' '+r.name,`<p>現價 ${numberText(r.price)} ${r.fx>1.5?'USD':'TWD'}${isLive()&&c?' · '+changeLabel(c):''}</p><dl class="position-detail">${[['股數／餘額',r.shares],['平均成本',r.avg],['本金 TWD',r.prin],['匯率',r.fx],['市值 TWD',mv(r)],['損益 TWD',pnl(r)]].map(([k,v])=>`<div><dt>${k}</dt><dd>${numberText(v)}</dd></div>`).join('')}</dl><p class="muted">${safeText(r.note||'尚無備註')}</p><p class="muted">報價取得：${safeText(r.quoteUpdatedAt?new Date(r.quoteUpdatedAt).toLocaleString('zh-TW'):'尚無時間紀錄')}</p>${isLive()?`<div class="detail-actions">${['現金','貸款'].includes(r.cls)?iconAction('edit','更新餘額',`closeExtra();openEdit(${i})`):iconAction('plus','加碼',`closeExtra();openTrade(${i},'buy')`)+iconAction('minus','減碼',`closeExtra();openTrade(${i},'sell')`)}${iconAction('more','更多操作',`positionMore(${i})`)}</div>`:''}`);}
function openAuditForRow(i){openAudit(data[i]?._id);}
openAudit=function(id){setTab('records');document.getElementById('auditSearch').value=id?(data.find(r=>r._id===id)?.code||audit.flatMap(a=>a.changes||[]).find(c=>c.id===id)?.after?.code||''):'';document.getElementById('auditDate').value='';renderAuditPage();};
function clearAuditFilters(){document.getElementById('auditSearch').value='';document.getElementById('auditDate').value='';renderAuditPage();}
function auditDay(a){const day=a.input?.tradeDate||a.tradeDate;if(PortfolioCore.validDate(day))return day;if(a.createdAt){const d=new Date(a.createdAt);if(!isNaN(d))return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}const m=(a.at||'').match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);return m?`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`:'';}
function renderAuditPage(){
  const q=document.getElementById('auditSearch').value.trim().toLowerCase(),day=document.getElementById('auditDate').value;
  const entries=audit.map((a,index)=>({a,index})).filter(({a})=>(!q||JSON.stringify(a).toLowerCase().includes(q))&&(!day||auditDay(a)===day)).sort((x,y)=>auditDay(y.a).localeCompare(auditDay(x.a))||y.index-x.index);
  document.getElementById('auditList').innerHTML=entries.length?entries.map(({a,index},i)=>{
    const actionable=!a.undone&&!a.undoOf&&!a.revisionOf&&a.changes?.length===1,editable=actionable&&!!PortfolioCore.tradeInput(a);
    return `<details class="audit-entry" data-audit-index="${index}" ${i===0?'open':''}><summary><strong>${safeText(a.label)}${a.undone?' · 已撤銷':a.revisedAt?' · 已修改':''}</strong><span class="audit-date">${safeText((a.input?.tradeDate||a.tradeDate)?auditDay(a):'登錄日 '+auditDay(a))}<small>登錄 ${safeText(a.at)}</small></span></summary>${actionable?`<div class="audit-entry-actions">${editable?iconAction('edit','修改交易',`editAuditTrade(${index})`):''}${iconAction('undo','撤銷這筆',`undoAuditEntry(${index})`)}</div>`:''}<p>${auditDetails(a)}</p></details>`;
  }).join(''):'<p class="empty-note">'+(audit.length?'沒有符合的操作紀錄。':'尚無操作紀錄。下次加減碼或編輯後，會在這裡保留修改前後的內容。')+'</p>';
}

function renderSettings(){document.getElementById('quoteConnectionState').textContent=sheetUrl?'已設定報價來源':'尚未設定報價來源';renderCloudSetup();}
function chooseSetup(value){setupChoice=value;renderCloudSetup();}
function savedPrivateUrl(){try{return localStorage.getItem('portfolio_private_url')||'';}catch{return '';}}
function renderCloudSetup(){
 const connected=!!syncConnection,legacy=legacyCloudAvailable()&&!connected;
 document.getElementById('cloudSetupBody').innerHTML=`<div class="setup-status"><strong>${connected?'已連接 Google Drive 同步':legacy?'目前使用舊版 Google 私人頁面':'在原本網址啟用跨裝置同步'}</strong><p id="settingsCloudStatus">${safeText(document.getElementById('cloudState').textContent)}</p><p>電腦與手機都開啟相同的 GitHub 網址，填入同一組服務網址與驗證碼。持倉、快照及紀錄保存在你的 Google Drive。</p>${connected?`<p>最後同步：<span id="lastCloudTime">${safeText(cloudMeta.syncedAt?new Date(cloudMeta.syncedAt).toLocaleString('zh-TW'):'尚未完成')}</span></p>`:''}</div>
 ${legacy?'<p class="muted">如果要改用 GitHub 網址，先在此下載備份，再到 GitHub 網頁匯入並連接新服務。舊試算表不會自動搬移。</p>':''}
 <form class="private-link-form" onsubmit="event.preventDefault();connectDriveSync()"><label for="syncServiceUrl">同步服務網址</label><input id="syncServiceUrl" type="url" value="${safeText(syncConnection?.url||'')}" placeholder="https://script.google.com/macros/s/…/exec" required><label for="syncServiceToken">同步驗證碼</label><input id="syncServiceToken" type="password" autocomplete="off" spellcheck="false" placeholder="${connected?'未變更網址時，可留空沿用已保存驗證碼':'貼上相同的 64 字元驗證碼'}"><p class="muted">驗證碼可讀寫你的同步資料，請自行保存並只交給自己的裝置。它不會包含在持倉備份內。</p><div class="setup-actions"><button id="connectDriveBtn" class="btn primary" type="submit">測試並儲存連線</button>${connected?'<button class="btn" type="button" onclick="syncCloud(true)">立即同步</button><button class="btn" type="button" onclick="disconnectDriveSync()">中斷連線</button>':''}</div><p id="syncConnectionStatus" class="status-note" role="status"></p></form>
 <details class="instructions" ${connected?'':'open'}><summary>第一次設定 Google 同步服務</summary><ol class="setup-steps">
 <li><h3>備份目前資料</h3><button class="btn" onclick="exportJSON()">下載目前資料備份</button></li>
 <li><h3>建立專用 Google 專案</h3><p>不要覆蓋接案追蹤器或報價服務。只需要 Code.gs，不需要新增 Index.html。</p><a class="btn" href="https://script.google.com/home/start" target="_blank" rel="noopener noreferrer">開啟 Google Apps Script</a><div class="code-copy"><button class="btn" onclick="copySetupFile('server')">複製服務程式</button><button class="text-btn" onclick="downloadSetupFile('server')">下載 Code.gs</button></div><p id="setupCopyStatus" class="status-note" role="status"></p><details class="instructions"><summary>無法複製時，展開程式內容</summary><select id="setupCodeType" onchange="showSetupCode()" aria-label="部署檔案"><option value="server">Code.gs</option></select><textarea id="setupCodePreview" readonly aria-label="部署程式內容" onclick="this.select()"></textarea></details></li>
 <li><h3>設定同步驗證碼</h3><button class="btn" onclick="generateSyncToken()">產生新驗證碼</button><input id="generatedSyncToken" readonly aria-label="新產生的同步驗證碼" onclick="this.select()"><p>複製並自行保存。到 Google 專案「專案設定 → 指令碼屬性」新增 SYNC_TOKEN，值貼上驗證碼並儲存。不要把驗證碼貼進程式碼。</p></li>
 <li><h3>部署同步服務</h3><p>「部署 → 新增部署 → 網頁應用程式」，執行身分選「我」，誰可以存取選「任何人」。完成 Google 授權，再複製 /exec 網址填到上方。資料夾不需公開分享；服務會驗證每次請求的驗證碼。</p></li>
 <li><h3>連接電腦與手機</h3><p>電腦在上方測試連線後，選「建立我的雲端資料」。手機開啟同一個 GitHub 網址，填入相同服務網址與驗證碼，再選「載入我的雲端資料」。之後只在實際編修或更新報價後同步。切換分頁不會同步；要載入另一裝置的最新資料，可按「立即同步」。</p></li></ol></details>`;
 showSetupCode();
}
function generateSyncToken(){const bytes=crypto.getRandomValues(new Uint8Array(32));const token=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');document.getElementById('generatedSyncToken').value=token;document.getElementById('syncServiceToken').value=token;}
async function connectDriveSync(){
 const status=document.getElementById('syncConnectionStatus'),url=validPrivateUrl(document.getElementById('syncServiceUrl').value),token=document.getElementById('syncServiceToken').value.trim()||(url===syncConnection?.url?syncConnection.token:'');
 if(!url||!/^[a-f0-9]{64}$/.test(token)){status.textContent='請填入 /exec 服務網址與 64 字元驗證碼。';return;}
 if(cloudBusy){status.textContent='目前正在同步，請稍後再試。';return;}
 cloudBusy=true;document.getElementById('connectDriveBtn').disabled=true;status.textContent='正在測試連線…';
 try{
 const connection={url,token};await callDriveService(connection,'info');
 const changed=JSON.stringify(connection)!==JSON.stringify(syncConnection);
 if(changed){cloudMeta={revision:null,ack:null,syncedAt:null};saveDirty=true;persistNow();if(saveDirty)throw Error('本機無法保存設定，請先備份');}
 localStorage.setItem(SYNC_CONFIG_KEY,JSON.stringify(connection));syncConnection=connection;cloudConflict=null;cloudPaused=false;cloudStatus('連線成功 · 準備檢查雲端版本');renderCloudSetup();
 }catch(e){const el=document.getElementById('syncConnectionStatus');if(el)el.textContent='連線未儲存：'+e.message;return;}
 finally{cloudBusy=false;const button=document.getElementById('connectDriveBtn');if(button)button.disabled=false;}
 await syncCloud(true);
}
function disconnectDriveSync(){
 if(cloudBusy){document.getElementById('syncConnectionStatus').textContent='請等待同步完成後再中斷。';return;}
 if(!confirm('中斷這台裝置的自動同步？本機及 Google Drive 資料都會保留。'))return;
 try{localStorage.removeItem(SYNC_CONFIG_KEY);}catch{document.getElementById('syncConnectionStatus').textContent='瀏覽器無法移除設定，請稍後再試。';return;}
 syncConnection=null;cloudConflict=null;clearTimeout(cloudTimer);cloudMeta={revision:null,ack:null,syncedAt:null};persistCloudMeta();cloudStatus(legacyCloudAvailable()?'已回到舊版 Google 同步':'僅此裝置 · 已中斷連線');renderCloudSetup();
}

function setupFile(kind){const files=globalThis.CLOUD_INSTALL_FILES;if(!files?.[kind])throw Error('此版本沒有附部署檔案。請從專案的 apps-script 資料夾取得 Code.gs 與 Index.html。');return files[kind];}
function showSetupCode(){const el=document.getElementById('setupCodePreview');if(el){try{el.value=setupFile(document.getElementById('setupCodeType').value);}catch(e){el.value=e.message;}}}
async function copySetupFile(kind){const status=document.getElementById('setupCopyStatus');try{await navigator.clipboard.writeText(setupFile(kind));status.textContent='已複製 '+(kind==='server'?'Code.gs':'Index.html')+'，請到 Google 專案貼上。';}catch(e){status.textContent='無法自動複製，請下載檔案，或展開下方內容後全選複製。';document.getElementById('setupCodePreview').closest('details').open=true;document.getElementById('setupCodeType').value=kind;showSetupCode();}}
function downloadSetupFile(kind){try{download(new Blob([setupFile(kind)],{type:'text/plain;charset=utf-8'}),kind==='server'?'Code.gs':'Index.html');document.getElementById('setupCopyStatus').textContent='已開始下載，請開啟檔案並貼入 Google 專案。';}catch(e){alert(e.message);}}
function validPrivateUrl(raw){try{const u=new URL(raw.trim());if(u.protocol!=='https:'||u.hostname!=='script.google.com'||u.username||u.password||u.port||!/^\/macros\/s\/[\w-]+\/exec$/.test(u.pathname))return null;return u.origin+u.pathname;}catch{return null;}}
function rememberPrivateUrl(){const url=validPrivateUrl(document.getElementById('privateAppUrl').value);const status=document.getElementById('privateUrlStatus');if(!url){status.textContent='請貼上 Google 部署得到、以 /exec 結尾的私人網址。';return null;}try{localStorage.setItem('portfolio_private_url',url);document.getElementById('privateAppUrl').value=url;status.textContent='網址已儲存。請開啟私人版後完成資料載入。';return url;}catch{status.textContent='此瀏覽器無法保存網址，請先自行收藏。';return url;}}
function visitPrivateApp(){const url=rememberPrivateUrl();if(url)window.open(url,'_blank','noopener,noreferrer');}
async function copyPrivateUrl(){const url=rememberPrivateUrl();if(!url)return;try{await navigator.clipboard.writeText(url);document.getElementById('privateUrlStatus').textContent='已複製網址。請在手機開啟並登入同一 Google 帳號。';}catch{document.getElementById('privateAppUrl').select();document.getElementById('privateUrlStatus').textContent='請複製已選取的網址。';}}
// Keep overlays reachable and return keyboard focus to the invoking control.
const overlayFocus=new WeakMap();
for(const ov of document.querySelectorAll('.ov')){
  const panel=ov.querySelector('.modal');if(!panel)continue;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');const title=panel.querySelector('h3');if(title){if(!title.id)title.id='title-'+ov.id;panel.setAttribute('aria-labelledby',title.id);}
  new MutationObserver(()=>{if(ov.classList.contains('show')){overlayFocus.set(ov,document.activeElement);const target=panel.querySelector('input:not([type=hidden]),select,button');target?.focus();}else{const prior=overlayFocus.get(ov);if(prior?.isConnected)prior.focus();}}).observe(ov,{attributes:true,attributeFilter:['class']});
}
document.addEventListener('keydown',e=>{const ov=document.querySelector('.ov.show');if(!ov)return;const focusables=[...ov.querySelectorAll('button,input,select,textarea,a[href]')].filter(x=>!x.disabled&&x.getClientRects().length);if(e.key==='Escape'){e.preventDefault();ov.classList.remove('show');if(ov.id==='ovImport')pendingImport=null;}if(e.key==='Tab'&&focusables.length){const first=focusables[0],last=focusables.at(-1);if(e.shiftKey&&(document.activeElement===first||!ov.contains(document.activeElement))){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
const statusBeforeUI=cloudStatus;
cloudStatus=function(message){statusBeforeUI(message);const badge=document.getElementById('cloudState');if(badge)badge.dataset.state=/^已同步/.test(message)?'synced':/未完成|失敗|版本|離線|逾時/.test(message)?'error':/同步中|待同步|等待/.test(message)?'pending':'local';const detail=document.getElementById('settingsCloudStatus');if(detail)detail.textContent=message;const time=document.getElementById('lastCloudTime');if(time)time.textContent=cloudMeta.syncedAt?new Date(cloudMeta.syncedAt).toLocaleString('zh-TW'):'尚未完成';};
const saveSyncBeforeUI=saveSync;saveSync=function(){saveSyncBeforeUI();if(tab==='settings')renderSettings();};
const archiveBeforeUI=archiveNow;archiveNow=function(){archiveBeforeUI();if(tab==='analy')refreshComparison();};
// Tone down legacy labels and keep all five pages initialized without changing their data.
document.querySelectorAll('.tag').forEach(el=>{if(!el.id&&/^[A-Z\s·/&]+$/.test(el.textContent.trim()))el.remove();});
renderKPI();renderTable();renderSettings();setTab('hold');
if(!cloudAvailable())cloudStatus('僅此裝置 · 未啟用同步');

// Cache-busting is only used during navigation; keep the address bar/bookmarks clean.
if(!cloudAvailable()&&/^https?:$/.test(location.protocol)){
 const clean=new URL(location.href);
 if(clean.searchParams.has('_app')||clean.searchParams.has('_refresh')){
  clean.searchParams.delete('_app');clean.searchParams.delete('_refresh');
  history.replaceState(history.state,'',clean.pathname+clean.search+clean.hash);
 }
}
let appUpdateUserEditing=false;
document.addEventListener('input',()=>{appUpdateUserEditing=true;},true);
document.addEventListener('change',()=>{appUpdateUserEditing=true;},true);
function appUpdateAttemptKey(){return 'tracker-update:'+location.pathname;}
function canAutoUpdate(){
 if(appUpdateUserEditing||document.visibilityState!=='visible'||document.querySelector('.ov.show')||document.getElementById('extraDialog')?.open||document.activeElement?.matches('input,textarea,select,[contenteditable="true"]')||cloudBusy)return false;
 try{return sessionStorage.getItem(appUpdateAttemptKey())!==availableAppVersion;}catch{return false;}
}
// Probe without cache; never reload automatically twice for the same deployed version.
const runningAppVersion=document.querySelector('meta[name="app-version"]')?.content||'';
let availableAppVersion='',appUpdateChecking=false,lastAppUpdateCheck=0;
function updateAppMessage(message){document.getElementById('appUpdateStatus').textContent=message;}
async function checkAppUpdate(manual=false){
 if(appUpdateChecking)return;
 if(legacyCloudAvailable()){updateAppMessage('私人版需先在 Google 更新部署版本，再重新開啟私人網址。');return;}
 if(!/^https?:$/.test(location.protocol)){updateAppMessage('本機檔案請更新專案後重新開啟；GitHub 網頁版可線上檢查更新。');return;}
 appUpdateChecking=true;lastAppUpdateCheck=Date.now();const button=document.getElementById('checkUpdateBtn');button.disabled=true;if(manual)updateAppMessage('正在檢查…');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{const url=new URL('version.json',location.href);url.searchParams.set('_check',Date.now());const response=await fetch(url,{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('版本資訊尚未發布');const manifest=await response.json();if(!/^[a-f0-9]{16}$/.test(manifest.version))throw Error('版本資訊格式錯誤');
 availableAppVersion=manifest.version;const changed=availableAppVersion!==runningAppVersion;document.getElementById('reloadUpdateBtn').hidden=!changed;updateAppMessage(changed?'發現新版。完成目前編輯後，可保存資料並重新載入。':'目前已是最新版本。');
 let banner=document.getElementById('appUpdateBanner');if(changed&&!banner){banner=document.createElement('div');banner.id='appUpdateBanner';banner.className='histbanner show';banner.setAttribute('role','status');banner.innerHTML='<span>程式有新版可用；資料會保留。</span><button class="btn" onclick="focusSetting(\'updatePanel\')">查看更新</button>';document.querySelector('.app-nav').after(banner);}else if(!changed)banner?.remove();
 if(changed&&!manual&&canAutoUpdate())reloadAppUpdate(true);
 }catch(e){if(manual)updateAppMessage('無法檢查更新，請確認網路與網站部署後重試。現有資料不受影響。');}
 finally{clearTimeout(timer);appUpdateChecking=false;button.disabled=false;}
}
function reloadAppUpdate(automatic=false){
 if(!availableAppVersion||availableAppVersion===runningAppVersion)return;
 if(automatic&&!canAutoUpdate())return;
 if(document.querySelector('.ov.show')||document.getElementById('extraDialog')?.open){updateAppMessage('請先儲存或關閉目前的編輯視窗，再更新。');return;}
 if(typeof cloudBusy!=='undefined'&&cloudBusy){updateAppMessage('資料正在同步，請完成後再更新。');return;}
 saveDirty=true;persistNow();if(saveDirty){updateAppMessage('本機資料未能保存，已停止重新載入。請先下載備份。');return;}
 try{sessionStorage.setItem(appUpdateAttemptKey(),availableAppVersion);}catch{if(automatic)return;}
 const url=new URL(location.href);url.searchParams.set('_app',availableAppVersion);url.searchParams.set('_refresh',Date.now());location.replace(url.href);
}
document.getElementById('appVersionLabel').textContent='目前程式版本：'+(runningAppVersion||'開發版本');
setTimeout(()=>checkAppUpdate(),2500);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&Date.now()-lastAppUpdateCheck>300000)checkAppUpdate();});

// Current inventory exposure at today's exchange rate, relative to the selected price snapshot.
function comparisonPnl(r,c){
  if(!c||r.shares==null||r.shares===''||r.fx==null||r.fx==='')return null;
  const shares=Number(r.shares),fx=Number(r.fx),value=c.delta*shares*fx;
  return Number.isFinite(shares)&&shares>=0&&Number.isFinite(fx)&&fx>0&&Number.isFinite(value)?value:null;
}

// A single outline icon family; labels stay available to assistive technology and tooltips.
function actionIcon(name){const paths={undo:'<path d="M9 5 3 11l6 6M3 11h11a6 6 0 0 1 6 6v2"/>',refresh:'<path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1"/>',camera:'<path d="M3 7h4l2-3h6l2 3h4v13H3Z"/><circle cx="12" cy="13" r="4"/>',sort:'<path d="M8 3v18m-4-4 4 4 4-4M16 21V3m-4 4 4-4 4 4"/>',check:'<path d="m5 12 4 4L19 6"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.1"/>',folder:'<path d="M3 6h7l2 3h9v11H3Z"/>',plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',edit:'<path d="m4 16-1 5 5-1L20 8l-4-4Z M13 7l4 4"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>'};return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name]||paths.more}</svg>`;}
function iconAction(icon,label,handler){return `<button type="button" class="icon-action" title="${label}" aria-label="${label}" onclick="${handler}">${actionIcon(icon)}</button>`;}
function closeExtra(){document.getElementById('extraDialog')?.close();}
function positionMore(i){if(!isLive()||!data[i])return;closeExtra();openPositionEditor(i);}
function positionEditorAudit(){if(!isLive()||editIdx<0||!data[editIdx])return;const i=editIdx;closeModal();openAuditForRow(i);}
// Touch users can hold an icon to read its label without triggering its action.
let iconHoldTimer,heldIcon=null;
document.addEventListener('pointerdown',e=>{const b=e.target.closest('.icon-action');if(!b||e.pointerType!=='touch')return;iconHoldTimer=setTimeout(()=>{heldIcon=b;let tip=document.getElementById('iconHint');if(!tip){tip=document.createElement('div');tip.id='iconHint';tip.setAttribute('role','status');document.body.append(tip);}tip.textContent=b.getAttribute('aria-label');const r=b.getBoundingClientRect();tip.style.left=Math.max(8,Math.min(innerWidth-140,r.left))+'px';tip.style.top=Math.max(8,r.top-38)+'px';tip.hidden=false;},500);});
for(const event of ['pointerup','pointercancel','pointermove'])document.addEventListener(event,()=>clearTimeout(iconHoldTimer));
document.addEventListener('click',e=>{if(heldIcon){const b=e.target.closest('.icon-action');if(b===heldIcon){e.preventDefault();e.stopImmediatePropagation();}heldIcon=null;}const tip=document.getElementById('iconHint');if(tip)tip.hidden=true;},true);
const baseExtra=openExtra;
openExtra=function(title,html){baseExtra(title,html);const b=document.querySelector('#extraDialog > button');b.innerHTML=actionIcon('close');b.className='icon-action';b.title='關閉';b.setAttribute('aria-label','關閉');};

function setCompareDirection(value){document.getElementById('compareDirection').value=value;showCompare();}
function toggleComparisonHelp(button){const help=document.getElementById('comparisonHelp');help.hidden=!help.hidden;button.setAttribute('aria-expanded',String(!help.hidden));}
function compareSortHeading(metric,label,sort){const active=metric==='rate'?sort.startsWith('rate'):sort.startsWith('pnl');const ascending=sort.endsWith('Asc');return `<span><button class="compare-sort" data-sort="${metric}" aria-label="${label}排序${active?(ascending?'，目前由低到高':'，目前由高到低'):''}" onclick="sortComparison('${metric}')">${label}${active?` <span aria-hidden="true">${ascending?'↑':'↓'}</span>`:''}</button></span>`;}
function sortComparison(metric){const select=document.getElementById('compareSort');select.value=metric==='rate'?(select.value==='rate'?'rateAsc':'rate'):(select.value==='pnlDesc'?'pnlAsc':'pnlDesc');showCompare();}
function setQuoteButton(label,busy=false,done=false){const b=document.getElementById('syncBtn');b.innerHTML=actionIcon(done?'check':'refresh');b.title=label;b.setAttribute('aria-label',label);b.setAttribute('aria-busy',String(busy));}
document.querySelectorAll('[data-icon]').forEach(b=>b.innerHTML=actionIcon(b.dataset.icon));

let auditEditId=null;
function editAuditTrade(index){
  const entry=audit[index],t=PortfolioCore.tradeInput(entry);if(!t||entry.undone)return;
  auditEditId=entry.id;const c=entry.changes[0],code=c.after?.code||c.before.code;
  openExtra((t.direction==='sell'?'− ':'＋ ')+code+' · 修改交易',`<div class="audit-trade-form"><div class="frow"><label>交易日期<input id="txDate" type="date" value="${safeText(t.tradeDate||auditDay(entry))}" oninput="previewAuditTrade()"></label><label>股數<input id="txShares" type="number" step="any" min="0" value="${safeText(t.shares)}" oninput="previewAuditTrade()"></label></div><div class="frow"><label>${t.fixed?'總支出（含手續費）· TWD':'成交價'}<input id="txPrice" type="number" step="any" min="0" value="${safeText(t.fixed?t.total:t.price)}" oninput="previewAuditTrade()"></label><label>手續費 · ${t.fx>1.5?'USD':'TWD'}<input id="txFee" type="number" step="any" min="0" value="${safeText(t.fee)}" oninput="previewAuditTrade()"></label></div><label>交易匯率<input id="txFx" type="number" step="any" min="0" value="${safeText(t.fx)}" oninput="previewAuditTrade()"></label><div id="auditTradePreview" class="preview" aria-live="polite"></div><p id="auditTradeError" role="alert"></p><div class="audit-trade-actions">${iconAction('close','取消修改','closeExtra()')}${iconAction('check','確認修改交易','saveAuditTrade()')}</div></div>`);
  document.getElementById('txDate').focus();previewAuditTrade();
}
function auditTradeDraft(){
  const index=audit.findIndex(a=>a.id===auditEditId),entry=audit[index],t=PortfolioCore.tradeInput(entry);
  if(!t||entry.undone)throw Error('這筆紀錄已變更，請重新開啟');
  const tradeDate=document.getElementById('txDate').value;if(!PortfolioCore.validDate(tradeDate))throw Error('請填寫有效交易日期');
  return {index,input:{...entry.input,...t,kind:'trade',tradeDate,shares:numberInput('txShares'),fee:numberInput('txFee',true)??0,fx:numberInput('txFx'),...(t.fixed?{total:numberInput('txPrice')}:{price:numberInput('txPrice')})}};
}
function previewAuditTrade(){
  const box=document.getElementById('auditTradePreview'),error=document.getElementById('auditTradeError');
  try{const {index,input}=auditTradeDraft(),plan=PortfolioCore.revise(data,audit,index,input),old=data.find(r=>r._id===plan.subjectId),next=plan.rows.find(r=>r._id===plan.subjectId);
    box.innerHTML=`股數：${numberText(old?.shares)} → ${numberText(next?.shares)}<br>本金：${numberText(old?.prin)} → ${numberText(next?.prin)} TWD<br>平均成本：${numberText(old?.avg)} → ${numberText(next?.avg)}<br><small>按交易日期重算後續交易；最新報價保留。</small>`;error.textContent='';
  }catch(e){box.textContent='';error.textContent=e.message;}
}
function saveAuditTrade(){try{const {index,input}=auditTradeDraft();applyAuditRevision(index,input);}catch(e){document.getElementById('auditTradeError').textContent=e.message;}}
