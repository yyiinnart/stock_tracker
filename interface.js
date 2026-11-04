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
  empty.textContent='還沒有歷史快照。先儲存今日快照，下次更新價格後就能看變化。';
  const rows=data.filter(r=>!['現金','貸款'].includes(r.cls)).map(r=>({r,c:priceChange(r,key)})).filter(x=>direction==='all'||x.c&&(direction==='up'?x.c.delta>0:x.c.delta<0)).sort((a,b)=>(b.c?.rate??-Infinity)-(a.c?.rate??-Infinity));
  document.getElementById('compareResults').innerHTML=!key?'':!rows.length?'<p class="empty-note">無符合資料</p>':`<div class="compare-heading" aria-hidden="true"><span>標的</span><span>歷史價格</span><span>目前價格</span><span>價差</span><span>漲跌幅</span></div>`+rows.map(({r,c})=>`<article class="compare-row" style="--category:${CLR[r.cls]||'#c9ced8'}"><div class="compare-identity"><strong>${safeText(r.name)}</strong><small>${safeText(r.code)} · ${r.fx>1.5?'USD':'TWD'}</small></div><div class="old"><span class="label">${fmtLabel(key)}</span>${c?numberText(c.old):'—'}</div><div class="now"><span class="label">目前價格</span>${numberText(r.price)}</div><div class="difference">${c?signedNumber(c.delta):'—'}</div><div class="delta ${c?.delta>0?'pos':c?.delta<0?'neg':''}">${changeLabel(c)}<small>${c?'價差 '+signedNumber(c.delta):'該快照沒有有效價格'}</small></div></article>`).join('');
};
function numberText(value){return value==null||!Number.isFinite(Number(value))?'—':Number(value).toLocaleString('zh-TW',{maximumFractionDigits:4});}
function signedNumber(value){return (value>0?'+':'')+numberText(Math.round(value*10000)/10000);}
renderKPI=function(){const t=totals(curData());document.getElementById('kpis').innerHTML=`<div class="kpi"><div class="lbl">淨資產 · TWD</div><div class="val">${fmt(t.total)}</div><div class="delta">含現金，已扣除貸款</div></div><div class="kpi"><div class="lbl">未實現損益</div><div class="val ${t.pl>0?'pos':t.pl<0?'neg':''}">${signedNumber(t.pl)}</div><div class="delta">相對投入本金，不含息</div></div><div class="kpi"><div class="lbl">投入本金 · TWD</div><div class="val">${fmt(t.prin)}</div><div class="delta">投資部位，不含現金</div></div>`;};
renderTable=function(){
  originalRenderTable();const arr=curData(),key=latestBaseline();
  document.getElementById('hcount').textContent=`${arr.filter(r=>filter==='全部'||r.cls===filter).length} 檔${isLive()?(key?' · 較 '+fmtLabel(key):' · 尚無快照'):' · 歷史唯讀'}`;
  document.getElementById('quoteStamp').textContent=isLive()?(quoteUpdatedAt?'報價取得 '+new Date(quoteUpdatedAt).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'}):'報價時間尚無紀錄'):'快照日期 '+fmtLabel(viewKey);
  document.getElementById('addPositionBtn').disabled=!isLive();
  document.querySelectorAll('#hbody tr[data-idx]').forEach(tr=>{
    const i=Number(tr.dataset.idx),r=arr[i],simple=['現金','貸款'].includes(r.cls),c=isLive()&&!simple?priceChange(r,key):null;
    tr.style.setProperty('--category',CLR[r.cls]||'#c9ced8');tr.removeAttribute('onclick');tr.classList.remove('clickable');
    tr.cells[0].innerHTML=`<button class="position-name" onclick="${isLive()?'openEdit':'showPosition'}(${i})" aria-label="${safeText(r.code)} ${isLive()?'加減碼或編輯':'查看歷史部位'}"><span class="code">${safeText(r.name||r.code)}</span><small>${safeText(r.code)} · ${safeText(r.cls)}${isLive()?' · '+(simple?'更新餘額':'加減碼'):''}</small></button><div class="position-actions"><button class="text-btn" onclick="showPosition(${i})">詳情</button>${isLive()?`<button class="text-btn" onclick="openAuditForRow(${i})">紀錄</button>`:''}</div>`;
    tr.cells[3].innerHTML=simple?'<span class="price-unit">'+safeText(r.cls)+'</span>':`<span class="cell-label">現價 · ${r.fx>1.5?'USD':'TWD'}</span><span class="price-main">${numberText(r.price)}</span>${isLive()?`<span class="price-change ${c?.delta>0?'pos':c?.delta<0?'neg':''}">${changeLabel(c)}</span>`:''}`;
    tr.cells[4].insertAdjacentHTML('afterbegin',`<span class="cell-label">${r.cls==='貸款'?'剩餘欠款':'市值'} · TWD</span>`);
    tr.cells[8].insertAdjacentHTML('afterbegin','<span class="cell-label">相對成本損益</span>');
    const profit=pnl(r);if(profit==null||profit===0){tr.cells[8].className='';tr.cells[9].className='';}
    if(reorderMode&&isLive()){tr.cells[0].insertAdjacentHTML('afterbegin','<span class="drag-handle">↕ 拖曳排列</span>');}
  });
  if(!arr.length){document.getElementById('hbody').innerHTML='<tr><td colspan="10"><div class="empty-note">從第一筆持倉開始，或還原你已有的資料。<div class="empty-actions"><button class="btn primary" onclick="openAdd()">新增第一筆</button><button class="btn" onclick="focusSetting(\'backupPanel\')">還原備份</button></div></div></td></tr>';}
  if(tab==='records')renderAuditPage();
  if(tab==='analy'&&analysisSection==='compare')refreshComparison();
};
function showPosition(i){const r=curData()[i];if(!r)return;const c=priceChange(r,latestBaseline());openExtra(r.code+' '+r.name,`<p>現價 ${numberText(r.price)} ${r.fx>1.5?'USD':'TWD'}${isLive()&&c?' · '+changeLabel(c):''}</p><dl class="position-detail">${[['股數／餘額',r.shares],['平均成本',r.avg],['本金 TWD',r.prin],['匯率',r.fx],['市值 TWD',mv(r)],['損益 TWD',pnl(r)]].map(([k,v])=>`<div><dt>${k}</dt><dd>${numberText(v)}</dd></div>`).join('')}</dl><p class="muted">${safeText(r.note||'尚無備註')}</p><p class="muted">報價取得：${safeText(r.quoteUpdatedAt?new Date(r.quoteUpdatedAt).toLocaleString('zh-TW'):'尚無時間紀錄')}</p>${isLive()?`<button class="btn primary" onclick="document.getElementById('extraDialog').close();openEdit(${i})">${['現金','貸款'].includes(r.cls)?'更新餘額':'加減碼或編輯'}</button>`:''}`);}
function openAuditForRow(i){openAudit(data[i]?._id);}
openAudit=function(id){setTab('records');document.getElementById('auditSearch').value=id?(data.find(r=>r._id===id)?.code||audit.flatMap(a=>a.changes||[]).find(c=>c.id===id)?.after?.code||''):'';document.getElementById('auditDate').value='';renderAuditPage();};
function clearAuditFilters(){document.getElementById('auditSearch').value='';document.getElementById('auditDate').value='';renderAuditPage();}
function auditDay(a){if(a.createdAt){const d=new Date(a.createdAt);if(!isNaN(d))return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}const m=(a.at||'').match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);return m?`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`:'';}
function renderAuditPage(){const q=document.getElementById('auditSearch').value.trim().toLowerCase(),day=document.getElementById('auditDate').value;const entries=audit.filter(a=>(!q||JSON.stringify(a).toLowerCase().includes(q))&&(!day||auditDay(a)===day));document.getElementById('auditList').innerHTML=entries.length?entries.slice().reverse().map((a,i)=>`<details class="audit-entry" ${i===0?'open':''}><summary><strong>${safeText(a.label)}${a.undone?' · 已撤銷':''}</strong><span>${safeText(a.at)}</span></summary><p>${auditDetails(a)}</p></details>`).join(''):'<p class="empty-note">'+(audit.length?'沒有符合的操作紀錄。':'尚無操作紀錄。下次加減碼或編輯後，會在這裡保留修改前後的內容。')+'</p>';}
function renderSettings(){document.getElementById('quoteConnectionState').textContent=sheetUrl?'已設定報價來源':'尚未設定報價來源';renderCloudSetup();}
function chooseSetup(value){setupChoice=value;renderCloudSetup();}
function savedPrivateUrl(){try{return localStorage.getItem('portfolio_private_url')||'';}catch{return '';}}
function renderCloudSetup(){
  const hosted=cloudAvailable(),hasData=portfolioHasData(portfolioPayload());
  const status=document.getElementById('cloudState').textContent;
  const urlForm=`<form class="private-link-form" onsubmit="event.preventDefault();rememberPrivateUrl()"><label for="privateAppUrl">你的私人網頁網址</label><input id="privateAppUrl" type="url" value="${safeText(savedPrivateUrl())}" placeholder="https://script.google.com/macros/s/…/exec" autocomplete="url" aria-describedby="privateUrlHelp"><p class="muted" id="privateUrlHelp">電腦和手機都開啟這個網址，並登入同一個 Google 帳號。網址保存在此裝置。</p><div class="setup-actions"><button class="btn" type="submit">儲存網址</button><button class="btn" type="button" onclick="visitPrivateApp()">開啟私人版</button><button class="btn" type="button" onclick="copyPrivateUrl()">複製給手機</button></div><p id="privateUrlStatus" class="status-note" role="status"></p></form>`;
  const buttons=`<div class="setup-choice"><button class="btn" aria-pressed="${setupChoice==='new'}" onclick="chooseSetup('new')">第一次設定</button><button class="btn" aria-pressed="${setupChoice==='existing'}" onclick="chooseSetup('existing')">已有私人網址</button></div>`;
  let body;
  if(hosted){body=`<div class="setup-status"><strong>你正在使用私人版</strong><p id="settingsCloudStatus">${safeText(status)}</p><p>最後同步：<span id="lastCloudTime">${safeText(cloudMeta.syncedAt?new Date(cloudMeta.syncedAt).toLocaleString('zh-TW'):'尚未完成')}</span></p></div><div class="setup-actions"><button class="btn primary" onclick="syncCloud(true)">立即同步／檢查版本</button>${!hasData?'<button class="btn" onclick="focusSetting(\'backupPanel\')">匯入我的備份</button>':''}<button class="btn" onclick="exportJSON()">下載目前備份</button></div><p class="muted">修改後自動同步。離線時先留在本機；兩台裝置都改過時，會先請你選擇版本。</p>${urlForm}`;}
  else{body=`<div class="setup-status"><strong>資料目前只存在這個瀏覽器</strong><p>啟用同步需要一次 Google 私人網頁設定。GitHub 網頁及「更新報價」不會自動啟用跨裝置同步。</p></div>${buttons}`;
    if(setupChoice==='new'){body+=`<ol class="setup-steps"><li><h3>先保存目前資料</h3><p>換到新網址後，舊瀏覽器資料不會自動帶過去。</p><button class="btn" onclick="exportJSON()">下載目前資料備份</button></li><li><h3>建立私人 Google 專案</h3><p>建立獨立專案，不要覆蓋你原本抓股價的服務。</p><a class="btn" href="https://script.google.com/home/start" target="_blank" rel="noopener noreferrer">開啟 Google Apps Script</a></li><li><h3>貼入兩份檔案</h3><p>在 Google 專案中，將第一份貼進 Code.gs；再按「＋ → HTML」，名稱填 Index，貼入第二份。</p>${['server','page'].map((k)=>`<div class="code-copy"><strong>${k==='server'?'Code.gs':'Index.html'}</strong><button class="btn" onclick="copySetupFile('${k}')">複製${k==='server'?'服務程式':'網頁程式'}</button><button class="text-btn" onclick="downloadSetupFile('${k}')">下載檔案</button></div>`).join('')}<p class="status-note" id="setupCopyStatus" role="status"></p><details class="instructions"><summary>無法複製時，展開程式內容</summary><label for="setupCodeType">選擇檔案</label><select id="setupCodeType" onchange="showSetupCode()"><option value="server">Code.gs</option><option value="page">Index.html</option></select><textarea id="setupCodePreview" readonly aria-label="部署程式內容" onclick="this.select()"></textarea></details></li><li><h3>部署成僅自己可用的網頁</h3><p>按「部署 → 新增部署」，類型選「網頁應用程式」。執行身分選「我」，誰可以存取選「僅限自己」。完成 Google 授權後，複製以 /exec 結尾的網址。</p><p>程式會建立私人同步試算表，不需要公開你的持倉。</p></li><li><h3>開啟私人版，帶入資料</h3><p>在私人版匯入剛才的備份，再建立雲端資料。手機使用同一網址，選「載入我的雲端資料」。</p>${urlForm}</li></ol>`;}
    else body+=`<p class="muted">在下方貼上已部署的私人網址。這會帶你前往私人版；目前這個頁面仍使用本機資料。</p><button class="btn" onclick="exportJSON()">先下載目前備份</button>${urlForm}`;
  }
  document.getElementById('cloudSetupBody').innerHTML=body;showSetupCode();
}
function setupFile(kind){const files=globalThis.CLOUD_INSTALL_FILES;if(!files?.[kind])throw Error('此版本沒有附部署檔案。請從專案的 apps-script 資料夾取得 Code.gs 與 Index.html。');return files[kind];}
function showSetupCode(){const el=document.getElementById('setupCodePreview');if(el){try{el.value=setupFile(document.getElementById('setupCodeType').value);}catch(e){el.value=e.message;}}}
async function copySetupFile(kind){const status=document.getElementById('setupCopyStatus');try{await navigator.clipboard.writeText(setupFile(kind));status.textContent='已複製 '+(kind==='server'?'Code.gs':'Index.html')+'，請到 Google 專案貼上。';}catch(e){status.textContent='無法自動複製，請下載檔案，或展開下方內容後全選複製。';document.querySelector('.instructions').open=true;document.getElementById('setupCodeType').value=kind;showSetupCode();}}
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

// Static deployments: probe the manifest without cache, then let the user reload safely.
const runningAppVersion=document.querySelector('meta[name="app-version"]')?.content||'';
let availableAppVersion='',appUpdateChecking=false,lastAppUpdateCheck=0;
function updateAppMessage(message){document.getElementById('appUpdateStatus').textContent=message;}
async function checkAppUpdate(manual=false){
 if(appUpdateChecking)return;
 if(cloudAvailable()){updateAppMessage('私人版需先在 Google 更新部署版本，再重新開啟私人網址。');return;}
 if(!/^https?:$/.test(location.protocol)){updateAppMessage('本機檔案請更新專案後重新開啟；GitHub 網頁版可線上檢查更新。');return;}
 appUpdateChecking=true;lastAppUpdateCheck=Date.now();const button=document.getElementById('checkUpdateBtn');button.disabled=true;if(manual)updateAppMessage('正在檢查…');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{const url=new URL('version.json',location.href);url.searchParams.set('_check',Date.now());const response=await fetch(url,{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('版本資訊尚未發布');const manifest=await response.json();if(!/^[a-f0-9]{16}$/.test(manifest.version))throw Error('版本資訊格式錯誤');
 availableAppVersion=manifest.version;const changed=availableAppVersion!==runningAppVersion;document.getElementById('reloadUpdateBtn').hidden=!changed;updateAppMessage(changed?'發現新版。完成目前編輯後，可保存資料並重新載入。':'目前已是最新版本。');
 let banner=document.getElementById('appUpdateBanner');if(changed&&!banner){banner=document.createElement('div');banner.id='appUpdateBanner';banner.className='histbanner show';banner.setAttribute('role','status');banner.innerHTML='<span>程式有新版可用；資料會保留。</span><button class="btn" onclick="focusSetting(\'updatePanel\')">查看更新</button>';document.querySelector('.app-nav').after(banner);}else if(!changed)banner?.remove();
 }catch(e){if(manual)updateAppMessage('無法檢查更新，請確認網路與網站部署後重試。現有資料不受影響。');}
 finally{clearTimeout(timer);appUpdateChecking=false;button.disabled=false;}
}
function reloadAppUpdate(){
 if(!availableAppVersion||availableAppVersion===runningAppVersion)return;
 if(document.querySelector('.ov.show')||document.getElementById('extraDialog')?.open){updateAppMessage('請先儲存或關閉目前的編輯視窗，再更新。');return;}
 if(typeof cloudBusy!=='undefined'&&cloudBusy){updateAppMessage('資料正在同步，請完成後再更新。');return;}
 saveNotes(true);saveDirty=true;persistNow();if(saveDirty){updateAppMessage('本機資料未能保存，已停止重新載入。請先下載備份。');return;}
 const url=new URL(location.href);url.searchParams.set('_app',availableAppVersion);url.searchParams.set('_refresh',Date.now());location.replace(url.href);
}
document.getElementById('appVersionLabel').textContent='目前程式版本：'+(runningAppVersion||'開發版本');
setTimeout(()=>checkAppUpdate(),2500);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&Date.now()-lastAppUpdateCheck>300000)checkAppUpdate();});
