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
const downloadPromise=page.waitForEvent('download');await page.evaluate(()=>exportJSON());const download=await downloadPromise;const backup=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert.equal(backup.audit.length,2);assert.equal(backup.live[0].price,120);
await page.evaluate(o=>{pendingImport=o;applyImport();},backup);assert.equal(await page.evaluate(()=>audit.length),2);
await page.reload();assert.equal(await page.evaluate(()=>audit.length),2);
await page.setViewportSize({width:390,height:844});await page.getByText('▲ +20.00%',{exact:true}).waitFor();await page.screenshot({path:path.join(root,'work/mobile.png'),fullPage:true,animations:'disabled'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
await page.locator('#hbody .position-name').first().click();await page.locator('#tradeDirection').selectOption('sell');await page.locator('#a_shares').fill('100');await page.locator('#a_price').fill('120');await page.locator('#saveBtn').click();assert.equal(await page.evaluate(()=>data[0].shares),900);assert.equal(await page.evaluate(()=>data[0].prin),45000);assert.equal(await page.evaluate(()=>audit.at(-1).input.proceeds),12000);
// Settings assets work without fetching source files; mobile values stay visible.
assert.ok((await page.locator('#hbody tr').first().boundingBox()).y<506);
assert.notEqual(await page.locator('#hbody tr').first().locator('td').nth(3).evaluate(el=>getComputedStyle(el).display),'none');
await page.locator('.sync-entry').click();await page.getByText('第一次設定',{exact:true}).waitFor();
assert.equal(await page.evaluate(()=>setupFile('server').includes('function doGet')),true);
assert.equal(await page.evaluate(()=>setupFile('page').includes('src="interface.js"')),false);
const codeDownload=page.waitForEvent('download');await page.evaluate(()=>downloadSetupFile('page'));assert.ok(fs.readFileSync(await (await codeDownload).path(),'utf8').includes('function renderCloudSetup'));
await page.getByText('已有私人網址',{exact:true}).click();await page.locator('#privateAppUrl').fill('https://example.com/exec');await page.getByRole('button',{name:'儲存網址',exact:true}).click();assert.match(await page.locator('#privateUrlStatus').innerText(),/請貼上 Google/);
await page.locator('#privateAppUrl').fill('https://script.google.com/macros/s/TEST/exec');await page.getByRole('button',{name:'儲存網址',exact:true}).click();assert.equal(await page.evaluate(()=>savedPrivateUrl()),'https://script.google.com/macros/s/TEST/exec');
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
await Promise.all([page.waitForURL('**_app=0123456789abcdef*'),page.locator('#reloadUpdateBtn').click()]);
assert.equal(await page.evaluate(()=>data[0].shares),900);assert.ok(await page.evaluate(()=>audit.length>=3));
// A failed probe must not expose a destructive fallback or clear local data.
await page.route('**/version.json?*',route=>route.abort());await page.evaluate(()=>checkAppUpdate(true));assert.match(await page.locator('#appUpdateStatus').innerText(),/無法檢查/);assert.equal(await page.evaluate(()=>data[0].shares),900);
console.log('PASS: current/stale/offline version checks, cache-busting reload and data preservation');
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
