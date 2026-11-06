const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('../work/browser/node_modules/playwright');
const root=path.resolve(__dirname,'..');
const fixture={live:[{_id:'a',code:'AAA',name:'測試股票',cls:'台股',shares:1000,price:115,fx:1,avg:50,prin:50000,note:''}],archives:{261101:[{code:'AAA',name:'測試股票',cls:'台股',price:100}]},dca:[],cal:[],yield:[],recurring:[],notes:'',audit:[]};
const server=http.createServer((req,res)=>{const name=decodeURIComponent(req.url.split('?')[0]);const file=path.join(root,name==='/'?'index.html':name);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html; charset=utf-8');res.end(fs.readFileSync(file));}catch(e){res.writeHead(404).end();}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;let browser;
try{browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const context=await browser.newContext({viewport:{width:1280,height:900}});await context.route('https://**/*',r=>r.abort());await context.addInitScript(seed=>{if(!localStorage.getItem('portfolioDemo_v3'))localStorage.setItem('portfolioDemo_v3',JSON.stringify(seed));},fixture);
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.goto(url);await page.getByText('▲ +15.00%',{exact:true}).waitFor();

async function tx(direction,shares,price,fee,date){await page.evaluate(d=>openTrade(0,d),direction);await page.locator('#a_date').fill(date);await page.locator('#a_shares').fill(String(shares));await page.locator('#a_price').fill(String(price));await page.locator('#a_fee').fill(String(fee));await page.locator('#saveBtn').click();assert.equal(await page.locator('#ov').isVisible(),false);}
await tx('buy',100,100,10,'2026-10-01');await tx('sell',100,120,10,'2026-10-03');await tx('buy',50,80,5,'2026-10-02');
assert.equal(await page.evaluate(()=>data[0].shares),1050);assert.ok(Math.abs(await page.evaluate(()=>data[0].prin)-64015*1050/1150)<1e-6);
assert.equal(await page.evaluate(()=>audit[0].input.tradeDate),'2026-10-01');assert.equal(await page.evaluate(()=>data[0].lastUp),'2026-10');
await page.evaluate(()=>{data[0].price=130;setTab('records');});
const first=page.locator('[data-audit-index="0"]');await first.locator('summary').click();await first.getByRole('button',{name:'修改交易',exact:true}).click();
assert.equal(await page.locator('#txShares').evaluate(el=>getComputedStyle(el).borderTopColor),'rgba(0, 0, 0, 0)');await page.locator('#txShares').fill('200');assert.notEqual(await page.locator('#txShares').evaluate(el=>getComputedStyle(el).borderTopColor),'rgba(0, 0, 0, 0)');await page.locator('#txDate').fill('2026-09-30');await page.locator('#txPrice').fill('90');await page.locator('#txFee').fill('20');
for(const width of [1440,768,390]){await page.setViewportSize({width,height:900});await page.screenshot({path:path.join(root,'work/history-edit-'+width+'.png')});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
await page.getByRole('button',{name:'確認修改交易',exact:true}).click();assert.equal(await page.evaluate(()=>data[0].shares),1150);assert.ok(Math.abs(await page.evaluate(()=>data[0].prin)-66263)<1e-6);assert.equal(await page.evaluate(()=>data[0].price),130);
await page.locator('#auditDate').fill('2026-09-30');assert.equal(await page.locator('.audit-entry').count(),1);assert.match(await page.locator('.audit-entry summary').innerText(),/已修改/);await page.evaluate(()=>clearAuditFilters());
const middle=page.locator('[data-audit-index="2"]');await middle.locator('summary').click();await middle.getByRole('button',{name:'撤銷這筆',exact:true}).click();assert.equal(await page.evaluate(()=>data[0].shares),1100);assert.ok(Math.abs(await page.evaluate(()=>data[0].prin)-68020*1100/1200)<1e-6);assert.equal(await page.evaluate(()=>data[0].price),130);
assert.equal(await page.locator('[data-audit-index="2"] .audit-entry-actions').count(),0);
for(const width of [1440,768,390]){await page.setViewportSize({width,height:900});await page.screenshot({path:path.join(root,'work/history-list-'+width+'.png'),fullPage:true});}
await page.reload();assert.equal(await page.evaluate(()=>audit[0].input.tradeDate),'2026-09-30');assert.equal(await page.evaluate(()=>audit[2].undone),true);assert.ok(await page.evaluate(()=>audit.some(a=>a.revisionOf)));
// Invalid chronological edits leave holdings and audit untouched.
await page.evaluate(()=>{setTab('records');editAuditTrade(0);});await page.locator('#txShares').fill('0');const before=await page.evaluate(()=>JSON.stringify({data,audit}));await page.getByRole('button',{name:'確認修改交易',exact:true}).click();assert.equal(await page.evaluate(()=>JSON.stringify({data,audit})),before);assert.match(await page.locator('#auditTradeError').innerText(),/股數/);
assert.deepEqual(errors,[]);console.log('PASS: backdated trades, date filtering, per-entry edit/cancel, chronological replay, quote preservation, focus-only frames and reload');
}finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
