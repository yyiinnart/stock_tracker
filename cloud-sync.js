/* Hosted by Apps Script: google.script.run stays within the private deployment. */
let cloudBusy=false,cloudTimer=null,cloudConflict=null,cloudPaused=false,cloudPending=false;
const legacyCloudAvailable=()=>typeof google!=='undefined'&&!!google.script?.run;
const SYNC_CONFIG_KEY='portfolio_sync_connection';
function readSyncConnection(){try{const o=JSON.parse(localStorage.getItem(SYNC_CONFIG_KEY)||'null');return o&&/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(o.url)&&/^[a-f0-9]{64}$/.test(o.token)?o:null;}catch{return null;}}
let syncConnection=readSyncConnection();
const cloudAvailable=()=>!!syncConnection||legacyCloudAvailable();
async function callDriveService(connection,method,args=[]){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
 try{const response=await fetch(connection.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},credentials:'omit',redirect:'follow',cache:'no-store',signal:controller.signal,body:JSON.stringify({token:connection.token,method,revision:args[0],payload:args[1]})});
 if(!response.ok)throw Error('服務連線失敗，請檢查部署網址與存取設定');
 let result;try{result=await response.json();}catch{throw Error('服務未回傳資料，請確認部署存取權為「任何人」');}
 if(!result.ok)throw Error(result.error||'同步失敗');
 if(method==='info'&&(result.service!=='stock-tracker-drive'||result.api!==1))throw Error('這不是 StockTracker 同步服務');
 if(method!=='info'&&(!Number.isInteger(result.revision)||result.revision<0))throw Error('服務版本資訊不正確');
 return result;
 }catch(e){if(e.name==='AbortError')throw Error('連線逾時，資料留在本機；請重試');throw e;}finally{clearTimeout(timer);}
}
function portfolioPayload(){return clone({v:5,live:data,dca,archives,sheetUrl,cal:CAL,yield:YIELD,notes,strategies,recurring,audit,quoteUpdatedAt,modifiedAt});}
function portfolioHasData(o){return !!o&&(!!o.notes?.trim()||StrategyCore.hasData(o.strategies)||['live','dca','cal','yield','recurring','audit'].some(k=>o[k]?.length>0)||Object.keys(o.archives||{}).length>0);}
function cloudContent(){const o=portfolioPayload();delete o.modifiedAt;return JSON.stringify(o);}
let cloudObserved=cloudContent();
function cloudStatus(message){const el=document.getElementById('cloudState');if(el)el.textContent=message;}
function persistCloudMeta(){saveDirty=true;persistNow();}
function callCloud(method,...args){if(syncConnection)return callDriveService(syncConnection,method,args);return new Promise((resolve,reject)=>{if(!cloudAvailable())return reject(Error('請從已部署的私人網頁開啟'));let done=false;const timer=setTimeout(()=>{done=true;reject(Error('連線逾時，資料留在本機；稍後可重試'));},25000);const ok=value=>{if(!done){done=true;clearTimeout(timer);resolve(value);}};const fail=e=>{if(!done){done=true;clearTimeout(timer);reject(Error(e.message||'連線失敗'));}};google.script.run.withSuccessHandler(ok).withFailureHandler(fail)[method](...args);});}
function formOpen(){return !!document.querySelector('.ov.show')||document.getElementById('extraDialog')?.open;}
function openCloud(){if(!cloudAvailable()){openExtra('啟用跨裝置同步','<p>本機版可正常記錄與比較。跨裝置同步請依專案的 CLOUD_SETUP.md 完成私人 Google 部署，再讓電腦與手機開啟同一網址、登入同一 Google 帳號。</p><p>首次使用：在本機匯出備份，再到私人網頁匯入。持倉資料不會隨程式部署上傳。</p>');return;}
openExtra('雲端同步',`<p>狀態：${safeText(document.getElementById('cloudState').textContent)}</p><p>最後同步：${safeText(cloudMeta.syncedAt?new Date(cloudMeta.syncedAt).toLocaleString('zh-TW'):'尚未同步')}</p><p><p>開啟頁面或切回分頁時會先檢查雲端版本；有實際編修或更新報價後也會自動同步。</p><button class="btn" onclick="document.getElementById('extraDialog').close();syncCloud(true)">立即同步／檢查版本</button>`);}
function showCloudConflict(remote){
cloudConflict=remote;
const localHas=portfolioHasData(portfolioPayload()),remoteHas=portfolioHasData(remote.payload);
const summary=(o)=>`${o?.live?.length||0} 筆持倉 · ${Object.keys(o?.archives||{}).length} 份快照 · ${o?.audit?.filter(a=>!a.checkpoint).length||0} 筆紀錄`;
const title=remoteHas?(localHas?'同步版本需要確認':'載入雲端資料'):(localHas?'首次雲端同步':'尚無同步資料');
cloudStatus(title);
const intro=remoteHas&&!localHas?'這台裝置尚無資料。載入雲端版本即可繼續使用，不會覆蓋雲端紀錄。':localHas&&remoteHas?'兩邊都有資料，請確認要保留的版本。取代前會自動下載被取代的資料備份。':localHas?'將這台裝置的資料建立為雲端版本，之後手機就能載入。':'先匯入備份或新增第一筆持倉，再建立雲端資料。';
openExtra(title,`<p>${intro}</p><div class="conflict-grid"><section><h4>這台裝置</h4><p>${summary(portfolioPayload())}</p><p>修改時間：${safeText(modifiedAt?new Date(modifiedAt).toLocaleString('zh-TW'):'尚無紀錄')}</p></section><section><h4>雲端版本</h4><p>${summary(remote.payload)}</p><p>更新時間：${safeText(remote.updatedAt?new Date(remote.updatedAt).toLocaleString('zh-TW'):'尚無紀錄')}</p></section></div><div class="conflict-actions">${remoteHas?`<button class="btn primary" onclick="resolveCloud('remote')">${localHas?'保留雲端，更新本機':'載入我的雲端資料'}</button>`:''}${localHas?`<button class="btn" onclick="resolveCloud('local')">${remoteHas?'保留本機，更新雲端':'建立我的雲端資料'}</button>`:''}${!remoteHas&&!localHas?`<button class="btn primary" onclick="cloudConflict=null;document.getElementById('extraDialog').close();focusSetting('backupPanel')">匯入備份</button><button class="btn" onclick="cloudConflict=null;document.getElementById('extraDialog').close();setTab('hold');openAdd()">新增第一筆</button>`:''}</div><p id="cloudConflictError" class="conflict-error" role="alert"></p>`);
}
function backupConflict(payload){download(new Blob([JSON.stringify({...payload,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'}),`同步取代前備份_${stamp()}.json`);}
function acceptRemote(remote){validatePortfolio(remote.payload);const o=remote.payload;data=clone(o.live);dca=o.dca||[];archives=o.archives||{};CAL=o.cal||[];YIELD=o.yield||[];notes=o.notes||'';strategies=StrategyCore.normalize(o.strategies,notes);recurring=o.recurring||[];audit=o.audit||[];sheetUrl=o.sheetUrl||'';quoteUpdatedAt=o.quoteUpdatedAt||'';modifiedAt=o.modifiedAt||'';ensureRowIds();switchView(viewKey);renderNotes();cloudMeta.revision=remote.revision;cloudMeta.ack=JSON.stringify(portfolioPayload());cloudMeta.syncedAt=new Date().toISOString();persistCloudMeta();if(saveDirty)throw Error('本機儲存失敗，請先匯出備份');if(sheetUrl)localStorage.setItem(URL_KEY,sheetUrl);else localStorage.removeItem(URL_KEY);cloudObserved=cloudContent();cloudPending=false;cloudStatus('已同步 · '+new Date().toLocaleTimeString('zh-TW'));}
async function resolveCloud(choice){
if(cloudBusy||!cloudConflict)return;
const remote=cloudConflict,localHas=portfolioHasData(portfolioPayload()),remoteHas=portfolioHasData(remote.payload);
if(choice==='local'&&!localHas){cloudStatus('沒有本機資料可上傳，請先載入雲端或匯入備份');return;}
if(choice==='remote'&&!remote.payload)return;
if(localHas&&remoteHas&&!confirm(choice==='local'?'確定用這台裝置的完整資料取代雲端版本？':'確定用雲端的完整資料取代這台裝置？'))return;
cloudBusy=true;
try{if(choice==='remote'){if(localHas)backupConflict(portfolioPayload());acceptRemote(remote);}else{if(remoteHas)backupConflict(remote.payload);await pushCloud(remote.revision);}cloudConflict=null;document.getElementById('extraDialog')?.close();}
catch(e){if(cloudConflict!==remote)showCloudConflict(cloudConflict);cloudStatus(e.message);const el=document.getElementById('cloudConflictError');if(el)el.textContent=e.message;}
finally{cloudBusy=false;}}
async function pushCloud(revision){const payload=portfolioPayload(),sent=JSON.stringify(payload);persistCloudMeta();if(saveDirty)throw Error('本機尚未成功儲存，暫停上傳');const response=await callCloud('savePortfolio',revision,payload);if(response.conflict){cloudConflict=response;throw Error('雲端剛有新修改，請再次檢查版本');}cloudMeta.revision=response.revision;cloudMeta.ack=sent;cloudMeta.syncedAt=new Date().toISOString();persistCloudMeta();cloudPending=JSON.stringify(portfolioPayload())!==sent;cloudObserved=cloudContent();cloudStatus(JSON.stringify(portfolioPayload())===sent?'已同步 · '+new Date().toLocaleTimeString('zh-TW'):'待同步（有新修改）');}
async function syncCloud(manual=false,pullFirst=false){if(!cloudAvailable()||cloudBusy||cloudPaused||(!manual&&((!cloudPending&&!pullFirst)||cloudConflict||formOpen())))return;if(!navigator.onLine){cloudStatus('離線，修改保存在本機');return;}cloudBusy=true;const started=JSON.stringify(portfolioPayload());cloudStatus('同步中…');try{const remote=await callCloud('readPortfolio');if(remote.payload)validatePortfolio(remote.payload);if(JSON.stringify(portfolioPayload())!==started||(!manual&&formOpen())){cloudStatus('有新修改，稍後再同步');return;}
const same=remote.payload&&JSON.stringify(remote.payload)===started;
if(same){cloudPending=false;cloudObserved=cloudContent();cloudMeta.revision=remote.revision;cloudMeta.ack=started;cloudMeta.syncedAt=new Date().toISOString();persistCloudMeta();cloudStatus('已同步 · '+new Date().toLocaleTimeString('zh-TW'));}
else if(cloudMeta.revision==null){showCloudConflict(remote);}
else if(remote.revision!==cloudMeta.revision){if(started!==cloudMeta.ack||!remote.payload)showCloudConflict(remote);else acceptRemote(remote);}
else if(started!==cloudMeta.ack){await pushCloud(remote.revision);}
else{cloudPending=false;cloudStatus('已同步 · '+new Date(cloudMeta.syncedAt).toLocaleTimeString('zh-TW'));}
}catch(e){cloudStatus('同步未完成：'+e.message);}finally{cloudBusy=false;}}
function flushPendingCloud(){if(!cloudPending||!cloudAvailable()||cloudConflict||cloudPaused)return;if(cloudBusy||formOpen()){cloudTimer=setTimeout(flushPendingCloud,500);return;}syncCloud();}
window.addEventListener('portfoliochange',()=>{const content=cloudContent();if(content===cloudObserved)return;cloudObserved=content;cloudPending=true;if(cloudAvailable()){cloudStatus(navigator.onLine?'待同步':'離線，修改保存在本機');clearTimeout(cloudTimer);cloudTimer=setTimeout(flushPendingCloud,1600);}});
window.addEventListener('online',()=>{if(cloudPending)flushPendingCloud();});
window.addEventListener('storage',e=>{if(e.key===KEY||e.key===SYNC_CONFIG_KEY){cloudPaused=true;cloudStatus('另一分頁修改了資料：請先備份本頁，再重新整理');}});
if(cloudAvailable())cloudStatus('已連線 · 修改後同步');else cloudStatus('僅此裝置 · 尚未連線');
let lastCloudPull=0;
function syncOnOpen(minGap=0){
 if(!cloudAvailable()||cloudBusy||cloudPaused||cloudConflict||formOpen())return;
 if(Date.now()-lastCloudPull<minGap)return;
 lastCloudPull=Date.now();
 syncCloud(false,true);
}
// 開啟頁面：強制檢查一次
window.addEventListener('load',()=>syncOnOpen(0));
// 手機從背景切回來：頁面不會重新載入，所以要另外監聽（間隔 30 秒避免頻繁呼叫）
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')syncOnOpen(30000);});
window.addEventListener('pageshow',e=>{if(e.persisted)syncOnOpen(0);});