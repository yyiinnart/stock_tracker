const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('../work/browser/node_modules/playwright');
const root=path.resolve(__dirname,'..');
const fixture={live:[{_id:'a',code:'AAA',name:'測試股票',cls:'台股',shares:1000,price:115,fx:1,avg:50,prin:50000,note:''}],archives:{261101:[{code:'AAA',name:'測試股票',cls:'台股',price:100}]},dca:[],cal:[],yield:[],recurring:[],notes:'',audit:[]};
const server=http.createServer((req,res)=>{const name=decodeURIComponent(req.url.split('?')[0]);const file=path.join(root,name==='/'?'index.html':name);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html; charset=utf-8');res.end(fs.readFileSync(file));}catch(e){res.writeHead(404).end();}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;let browser;
try{browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const context=await browser.newContext({viewport:{width:1280,height:900}});await context.route('https://**/*',r=>r.abort());await context.addInitScript(seed=>{if(!localStorage.getItem('portfolioDemo_v3'))localStorage.setItem('portfolioDemo_v3',JSON.stringify(seed));},fixture);
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.goto(url);await page.getByText('▲ +15.00%',{exact:true}).waitFor();

let calls=0,remote={revision:1,payload:null};const sc=await browser.newContext();await sc.route('https://**/*',r=>r.abort());
await sc.exposeBinding('mockCloud',(_,method,args)=>{calls++;if(method==='readPortfolio')return JSON.parse(JSON.stringify(remote));remote={revision:remote.revision+1,payload:args[1]};return {revision:remote.revision,updatedAt:new Date().toISOString()};});
await sc.addInitScript(seed=>{localStorage.setItem('portfolioDemo_v3',JSON.stringify(seed));function runner(ok=()=>{},fail=()=>{}){return new Proxy({withSuccessHandler:f=>runner(f,fail),withFailureHandler:f=>runner(ok,f)},{get:(o,k)=>o[k]||((...args)=>window.mockCloud(k,args).then(ok,fail))});}window.google={script:{run:runner()}};},fixture);
const sp=await sc.newPage();sp.on('dialog',d=>d.accept());sp.on('pageerror',e=>errors.push(e.message));await sp.clock.install();await sp.goto(url);await sp.clock.fastForward(35000);assert.equal(calls,0);
remote.payload=await sp.evaluate(()=>portfolioPayload());await sp.evaluate(()=>syncCloud(true));assert.equal(calls,1);
await sp.evaluate(()=>{for(const t of ['analy','records','plans','settings','hold'])setTab(t);document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('online'));save();});await sp.clock.fastForward(35000);assert.equal(calls,1);
await sp.evaluate(()=>{notes='實際修改';save();});await sp.clock.fastForward(1700);await sp.waitForFunction(()=>!cloudBusy&&cloudMeta.ack?.includes('實際修改'));assert.equal(calls,3);
await sp.evaluate(()=>{openEdit(0);notes='編輯未關閉';save();});await sp.clock.fastForward(2500);assert.equal(calls,3);await sp.evaluate(()=>closeModal());await sp.clock.fastForward(600);await sp.waitForFunction(()=>!cloudBusy&&cloudMeta.ack?.includes('編輯未關閉'));assert.equal(calls,5);
await sp.evaluate(()=>{sheetUrl='https://example.com/quotes';fetchSheet=async()=>({prices:{AAA:{price:123,fx:1}}});});await sp.locator('#syncBtn').click();await sp.waitForFunction(()=>data[0].price===123);await sp.clock.fastForward(1800);await sp.waitForFunction(()=>!cloudBusy&&cloudMeta.ack?.includes('123'));assert.equal(calls,7);
await sp.evaluate(()=>{setTab('records');setTab('hold');});await sp.clock.fastForward(65000);assert.equal(calls,7);await sc.close();
assert.deepEqual(errors,[]);console.log('PASS: no startup/tab/visibility/poll sync; actual edits and quote updates sync once; pending edits resume after closing forms');
}finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
