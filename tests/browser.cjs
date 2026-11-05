const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('../work/browser/node_modules/playwright');
const root=path.resolve(__dirname,'..');
const fixture={live:[{_id:'a',code:'AAA',name:'測試股票',cls:'台股',shares:1000,price:115,fx:1,avg:50,prin:50000,note:''}],archives:{261101:[{code:'AAA',name:'測試股票',cls:'台股',price:100}]},dca:[],cal:[],yield:[],recurring:[],notes:'',audit:[]};
const server=http.createServer((req,res)=>{const name=decodeURIComponent(req.url.split('?')[0]);const file=path.join(root,name==='/'?'index.html':name);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html; charset=utf-8');res.end(fs.readFileSync(file));}catch(e){res.writeHead(404).end();}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;let browser;
try{browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const context=await browser.newContext({viewport:{width:1280,height:900}});await context.route('https://**/*',r=>r.abort());await context.addInitScript(seed=>{if(!localStorage.getItem('portfolioDemo_v3'))localStorage.setItem('portfolioDemo_v3',JSON.stringify(seed));},fixture);
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.goto(url);await page.getByText('▲ +15.00%',{exact:true}).waitFor();
await page.locator('#hbody .position-name').first().click();await page.locator('#a_shares').fill('200');await page.locator('#a_price').fill('55');assert.match(await page.locator('#addPrev').innerText(),/1,200/);await page.locator('#saveBtn').click();assert.equal(await page.evaluate(()=>data[0].shares),1200);assert.equal(await page.evaluate(()=>audit.at(-1).input.price),55);
await page.evaluate(()=>{data[0].price=120;save();undoLastTrade();});assert.equal(await page.evaluate(()=>data[0].shares),1000);assert.equal(await page.evaluate(()=>data[0].price),120);
await page.locator('[data-page=records]').click();assert.match(await page.locator('#auditList').innerText(),/已撤銷/);
await page.evaluate(()=>openCompare());assert.match(await page.locator('#compareResults').innerText(),/20.00%/);await page.locator('#compareDirection').selectOption('down');assert.match(await page.locator('#compareResults').innerText(),/無符合資料/);await page.evaluate(()=>setTab('hold'));
// Inventory-weighted comparison: FX, missing values, signed ordering, live inventory.
await page.evaluate(()=>{data.push({_id:'usd',code:'USDTEST',name:'美元測試',cls:'美股',shares:10,price:90,fx:32,avg:100,prin:32000},{_id:'missing',code:'MISS',name:'缺少快照',cls:'台股',shares:10,price:20,fx:1});archives['261101'].push({code:'USDTEST',cls:'美股',price:100});openCompare();});
await page.locator('#compareDirection').selectOption('all');await page.locator('#compareSort').selectOption('pnlDesc');
assert.match(await page.locator('.comparison-pnl').first().innerText(),/20,000 元/);
await page.locator('#compareSort').selectOption('pnlAsc');assert.match(await page.locator('.comparison-pnl').first().innerText(),/-3,200 元/);assert.match(await page.locator('.compare-row').last().innerText(),/缺少快照/);
assert.equal(await page.evaluate(()=>comparisonPnl({shares:0,fx:32},{delta:10})),0);assert.equal(await page.evaluate(()=>comparisonPnl({shares:10,fx:null},{delta:10})),null);
await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(root,'work/comparison-mobile.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
await page.setViewportSize({width:1280,height:900});await page.screenshot({path:path.join(root,'work/comparison-desktop.png'),fullPage:true});
await page.evaluate(()=>{data=data.filter(r=>!['usd','missing'].includes(r._id));setTab('analy');showAnalysis('income');openIncomeImport();});
await page.getByRole('button',{name:'加入勾選標的'}).click();assert.equal(await page.evaluate(()=>YIELD.length),1);assert.match(await page.locator('#incomeUnscheduled').innerText(),/AAA/);
await page.evaluate(()=>incomeEdit(0));await page.locator('#y_d').fill('4');await page.locator('.income-months input[value="3"]').check();await page.locator('.income-months input[value="9"]').check();await page.locator('#incomeNote').fill('手動備註 <ETF>');await page.locator('#ovYld button').filter({hasText:'儲存'}).click();
assert.equal(await page.locator('#cal .income-entry').count(),2);assert.equal(await page.evaluate(()=>YIELD[0].y),4/120);assert.match(await page.locator('#cal').innerText(),/1,000 股/);
await page.reload();assert.deepEqual(await page.evaluate(()=>YIELD[0].months),[3,9]);await page.evaluate(()=>{setTab('analy');showAnalysis('income');incomeEdit(0);});assert.equal(await page.locator('#incomeNote').inputValue(),'手動備註 <ETF>');await page.locator('#y_d').fill('-1');await page.locator('#ovYld button').filter({hasText:'儲存'}).click();assert.equal(await page.evaluate(()=>YIELD[0].d),4);await page.evaluate(()=>closeYld());
await page.locator('#cal .income-remove').first().click();assert.equal(await page.locator('#cal .income-entry').count(),0);assert.equal(await page.evaluate(()=>YIELD.length),1);assert.equal(await page.evaluate(()=>data[0].shares),1000);
await page.evaluate(()=>incomeEdit(0));await page.locator('#incomeEnabled').check();await page.locator('#y_d').fill('0');await page.locator('#ovYld button').filter({hasText:'儲存'}).click();assert.equal(await page.evaluate(()=>YIELD[0].y),0);assert.equal(await page.evaluate(()=>YIELD[0].cost),null);
await page.evaluate(()=>openIncomeImport());assert.equal(await page.locator('[name="incomePosition"]:disabled').count(),1);await page.evaluate(()=>document.getElementById('extraDialog').close());
await page.screenshot({path:path.join(root,'work/calendar-desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(root,'work/calendar-mobile.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.setViewportSize({width:1280,height:900});
await page.evaluate(()=>{incomeEdit(0);yldDel();});assert.equal(await page.evaluate(()=>YIELD.length),0);assert.equal(await page.locator('#cal .income-entry').count(),0);await page.evaluate(()=>setTab('hold'));
const downloadPromise=page.waitForEvent('download');await page.evaluate(()=>exportJSON());const download=await downloadPromise;const backup=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert.equal(backup.audit.length,2);assert.equal(backup.live[0].price,120);
await page.evaluate(o=>{pendingImport=o;applyImport();},backup);assert.equal(await page.evaluate(()=>audit.length),2);
await page.reload();assert.equal(await page.evaluate(()=>audit.length),2);
await page.setViewportSize({width:390,height:844});await page.getByText('▲ +20.00%',{exact:true}).waitFor();await page.screenshot({path:path.join(root,'work/mobile.png'),fullPage:true,animations:'disabled'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
await page.locator('#hbody .position-name').first().click();await page.locator('#tradeDirection').selectOption('sell');await page.locator('#a_shares').fill('100');await page.locator('#a_price').fill('120');await page.locator('#saveBtn').click();assert.equal(await page.evaluate(()=>data[0].shares),900);assert.equal(await page.evaluate(()=>data[0].prin),45000);assert.equal(await page.evaluate(()=>audit.at(-1).input.proceeds),12000);
// Settings assets work without fetching source files; mobile values stay visible.
assert.ok((await page.locator('#hbody tr').first().boundingBox()).y<506);
assert.notEqual(await page.locator('#hbody tr').first().locator('td').nth(3).evaluate(el=>getComputedStyle(el).display),'none');
await page.locator('.sync-entry').click();await page.getByText('第一次設定 Google 同步服務',{exact:true}).waitFor();
assert.equal(await page.evaluate(()=>setupFile('server').includes('function doGet')),true);
assert.equal(await page.evaluate(()=>setupFile('page').includes('src="interface.js"')),false);
const codeDownload=page.waitForEvent('download');await page.evaluate(()=>downloadSetupFile('page'));assert.ok(fs.readFileSync(await (await codeDownload).path(),'utf8').includes('function renderCloudSetup'));
await page.locator('#syncServiceUrl').fill('https://example.com/exec');await page.evaluate(()=>connectDriveSync());assert.match(await page.locator('#syncConnectionStatus').innerText(),/請填入/);
await page.evaluate(()=>setTab('hold'));await page.locator('#addPositionBtn').click();await page.keyboard.press('Escape');assert.equal(await page.locator('.ov.show').count(),0);await page.waitForTimeout(30);assert.equal(await page.evaluate(()=>document.activeElement.id),'addPositionBtn');
await page.evaluate(()=>{switchView('261101');setTab('plans');});assert.equal(await page.evaluate(()=>isLive()),true);
// The generated Apps Script page must also run without any relative assets.
const hosted=await context.newPage();hosted.on('pageerror',e=>errors.push(e.message));await hosted.goto(url+'/apps-script/Index.html');await hosted.locator('.position-name').first().waitFor();await hosted.close();
assert.deepEqual(errors,[]);console.log('PASS: comparison, mobile layout, add preview, audit, quote-safe undo, backup/import/reload');
// A stale page sees a fresh manifest; reload preserves data and changes the document URL.
await page.evaluate(()=>setTab('settings'));
await page.evaluate(()=>checkAppUpdate(true));assert.match(await page.locator('#appUpdateStatus').innerText(),/最新版本/);assert.equal(await page.locator('#reloadUpdateBtn').isVisible(),false);
await page.route('**/version.json?*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({version:'0123456789abcdef'})}));
await page.evaluate(()=>checkAppUpdate(true));assert.equal(await page.locator('#reloadUpdateBtn').isVisible(),true);assert.equal(await page.locator('#appUpdateBanner').count(),1);
await page.evaluate(()=>{notes='update preservation';save();});
await Promise.all([page.waitForEvent('domcontentloaded'),page.locator('#reloadUpdateBtn').click()]);
assert.equal(new URL(page.url()).search,'');
assert.equal(await page.evaluate(()=>data[0].shares),900);assert.ok(await page.evaluate(()=>audit.length>=3));
// A failed probe must not expose a destructive fallback or clear local data.
await page.route('**/version.json?*',route=>route.abort());await page.evaluate(()=>checkAppUpdate(true));assert.match(await page.locator('#appUpdateStatus').innerText(),/無法檢查/);assert.equal(await page.evaluate(()=>data[0].shares),900);
// Passive opening updates once; a CDN still returning old HTML cannot cause a reload loop.
const auto=await context.newPage();let documentLoads=0;auto.on('request',r=>{if(r.isNavigationRequest()&&r.frame()===auto.mainFrame())documentLoads++;});
await auto.route('**/version.json?*',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({version:'fedcba9876543210'})}));
await auto.goto(url+'/?keep=1#hold');await auto.waitForFunction(()=>sessionStorage.getItem(appUpdateAttemptKey())==='fedcba9876543210');
await auto.waitForTimeout(3500);assert.equal(documentLoads,2);assert.equal(new URL(auto.url()).search,'?keep=1');assert.equal(new URL(auto.url()).hash,'#hold');assert.equal(await auto.evaluate(()=>data[0].shares),900);
// Any in-progress input defers automatic navigation.
await auto.locator('#hbody .position-name').first().click();await auto.locator('#a_shares').fill('42');await auto.route('**/version.json?*',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({version:'aaaaaaaaaaaaaaaa'})}));
await auto.evaluate(()=>checkAppUpdate());assert.equal(documentLoads,2);assert.equal(await auto.locator('#a_shares').inputValue(),'42');await auto.close();
console.log('PASS: clean URL, passive auto update, one-attempt loop protection, edit deferral and data preservation');
// GitHub-style clients talk through POST to a Drive service; no Google-hosted UI required.
let driveRemote={revision:0,payload:null,updatedAt:null},postCount=0;
const serviceUrl='https://script.google.com/macros/s/TEST/exec',secret='a'.repeat(64);
async function httpDevice(seed){const ctx=await browser.newContext();await ctx.route('https://**/*',r=>r.abort());await ctx.route(serviceUrl,async route=>{
 const req=route.request();assert.equal(req.method(),'POST');assert.equal(req.url().includes(secret),false);const body=req.postDataJSON();postCount++;
 let result;if(body.token!==secret)result={ok:false,error:'驗證失敗'};else if(body.method==='info')result={ok:true,service:'stock-tracker-drive',api:1};else if(body.method==='readPortfolio')result={ok:true,...driveRemote};else if(body.revision!==driveRemote.revision)result={ok:true,conflict:true,...driveRemote};else {driveRemote={revision:driveRemote.revision+1,payload:body.payload,updatedAt:new Date().toISOString()};result={ok:true,revision:driveRemote.revision,updatedAt:driveRemote.updatedAt};}
 await route.fulfill({contentType:'application/json',body:JSON.stringify(result)});
 });await ctx.addInitScript(seed=>localStorage.setItem('portfolioDemo_v3',JSON.stringify(seed)),seed);const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());await p.goto(url);await p.locator('.sync-entry').click();return p;}
async function connect(p,t=secret){await p.locator('#syncServiceUrl').fill(serviceUrl);await p.locator('#syncServiceToken').fill(t);await p.getByRole('button',{name:'測試並儲存連線'}).click();}
const h1=await httpDevice(fixture);await connect(h1,'b'.repeat(64));await h1.waitForFunction(()=>!cloudBusy);assert.equal(await h1.evaluate(()=>syncConnection),null);assert.equal(driveRemote.revision,0);
await connect(h1);await h1.getByRole('button',{name:'建立我的雲端資料',exact:true}).click();await h1.waitForFunction(()=>cloudMeta.revision===1&&!cloudBusy);
const h2=await httpDevice({live:[],audit:[],archives:{}});await connect(h2);await h2.getByRole('button',{name:'載入我的雲端資料',exact:true}).click();await h2.waitForFunction(()=>data.length===1&&!cloudBusy);
await h1.evaluate(async()=>{notes='Drive shared note';save();await syncCloud(true);});await h2.evaluate(()=>syncCloud(true));assert.equal(await h2.evaluate(()=>notes),'Drive shared note');
assert.equal(JSON.stringify(driveRemote.payload).includes(secret),false);
await h2.evaluate(async()=>{notes='conflict B';save();});await h1.evaluate(async()=>{notes='conflict A';save();await syncCloud(true);});await h2.evaluate(()=>syncCloud(true));assert.equal(await h2.locator('#extraDialog h3').innerText(),'同步版本需要確認');
await h2.getByRole('button',{name:'保留雲端，更新本機',exact:true}).click();await h2.waitForFunction(()=>!cloudBusy&&notes==='conflict A');
await h2.evaluate(()=>disconnectDriveSync());assert.equal(await h2.evaluate(()=>syncConnection),null);assert.equal(await h2.evaluate(()=>data.length),1);assert.equal(driveRemote.payload.notes,'conflict A');
assert.ok(postCount>5);await h1.context().close();await h2.context().close();console.log('PASS: HTTP token auth, first connection, two-device Drive sync, conflict, credential exclusion and disconnect');
// Two isolated devices call the real client transport against an in-memory CAS server.
let remote={revision:0,payload:null,updatedAt:null};
async function device(seed){const c=await browser.newContext();await c.route('https://**/*',r=>r.abort());await c.exposeBinding('testCloud',(_,method,args)=>{if(method==='readPortfolio')return JSON.parse(JSON.stringify(remote));if(args[0]!==remote.revision)return {...remote,conflict:true};remote={revision:remote.revision+1,payload:args[1],updatedAt:new Date().toISOString()};return {revision:remote.revision,updatedAt:remote.updatedAt};});await c.addInitScript(seed=>{localStorage.setItem('portfolioDemo_v3',JSON.stringify(seed));function runner(ok=()=>{},fail=()=>{}){return new Proxy({withSuccessHandler:f=>runner(f,fail),withFailureHandler:f=>runner(ok,f)},{get:(o,k)=>o[k]||((...args)=>window.testCloud(k,args).then(ok,fail))});}window.google={script:{run:runner()}};},seed);const p=await c.newPage();p.on('dialog',d=>d.accept());p.on('pageerror',e=>errors.push(e.message));await p.goto(url);return p;}
const a=await device(fixture);await a.getByText('建立我的雲端資料',{exact:true}).waitFor();await a.getByText('建立我的雲端資料',{exact:true}).click();await a.waitForFunction(()=>cloudMeta.revision===1&&!cloudBusy);
const b=await device({live:[],archives:{}});await b.getByText('載入我的雲端資料',{exact:true}).waitFor();assert.equal(await b.getByText('保留本機，更新雲端',{exact:true}).count(),0);await b.getByText('載入我的雲端資料',{exact:true}).click();await b.waitForFunction(()=>data.length===1&&!cloudBusy);
await a.evaluate(async()=>{notes='device A';save();await syncCloud(true);});assert.equal(remote.payload.notes,'device A');
await b.evaluate(async()=>{notes='device B';save();await syncCloud(true);});assert.equal(remote.payload.notes,'device A');assert.equal(await b.locator('#extraDialog h3').innerText(),'同步版本需要確認');
await b.getByText('保留雲端，更新本機',{exact:true}).click();await b.waitForFunction(()=>notes==='device A'&&!cloudBusy);
await b.context().setOffline(true);await b.evaluate(async()=>{notes='offline change';save();persistNow();await syncCloud(true);});assert.equal(remote.payload.notes,'device A');assert.match(await b.locator('#cloudState').innerText(),/離線/);await b.context().setOffline(false);await b.waitForFunction(()=>!cloudBusy);await b.evaluate(()=>syncCloud(true));assert.equal(remote.payload.notes,'offline change');
assert.deepEqual(errors,[]);console.log('PASS: first sync selection, two-device conflict, remote resolution, offline queue and reconnect');
}finally{if(browser)await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
