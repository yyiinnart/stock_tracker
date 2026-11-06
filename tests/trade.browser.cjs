const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('../work/browser/node_modules/playwright');
const root=path.resolve(__dirname,'..');
const fixture={live:[{_id:'a',code:'AAA',name:'測試股票',cls:'台股',shares:1000,price:115,fx:1,avg:50,prin:50000,note:''}],archives:{261101:[{code:'AAA',name:'測試股票',cls:'台股',price:100}]},dca:[],cal:[],yield:[],recurring:[],notes:'',audit:[]};
const server=http.createServer((req,res)=>{const name=decodeURIComponent(req.url.split('?')[0]);const file=path.join(root,name==='/'?'index.html':name);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html; charset=utf-8');res.end(fs.readFileSync(file));}catch(e){res.writeHead(404).end();}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;let browser;
try{browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const context=await browser.newContext({viewport:{width:1280,height:900}});await context.route('https://**/*',r=>r.abort());await context.addInitScript(seed=>{if(!localStorage.getItem('portfolioDemo_v3'))localStorage.setItem('portfolioDemo_v3',JSON.stringify(seed));},fixture);
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.goto(url);await page.getByText('▲ +15.00%',{exact:true}).waitFor();

await page.locator('#hbody .position-name').first().click();assert.equal(await page.locator('#extraDialog').evaluate(el=>el.open),true);await page.getByRole('button',{name:'關閉',exact:true}).click();
await page.locator('#hbody [aria-label="加碼"]').click();assert.equal(await page.locator('#modeSeg').isVisible(),false);assert.equal(await page.locator('#delBtn').isVisible(),false);
await page.locator('#a_shares').fill('200');await page.locator('#a_price').fill('97.3');await page.locator('#a_fee').fill('28');assert.match(await page.locator('#addPrev').innerText(),/19,488/);await page.locator('#saveBtn').click();
assert.equal(await page.evaluate(()=>data[0].prin),69488);assert.equal(await page.evaluate(()=>audit.at(-1).input.fee),28);
await page.reload();assert.equal(await page.evaluate(()=>audit.at(-1).input.total),19488);
await page.evaluate(()=>undoLastTrade());assert.equal(await page.evaluate(()=>data[0].prin),50000);
await page.locator('#hbody [aria-label="減碼"]').click();await page.locator('#a_shares').fill('100');await page.locator('#a_price').fill('120');await page.locator('#a_fee').fill('28');assert.match(await page.locator('#addPrev').innerText(),/11,972/);await page.locator('#saveBtn').click();assert.equal(await page.evaluate(()=>data[0].prin),45000);assert.equal(await page.evaluate(()=>audit.at(-1).input.proceeds),11972);
await page.evaluate(()=>undoLastTrade());
await page.evaluate(()=>{data.push({_id:'us',code:'VOO',name:'美國大型股',cls:'美股',shares:10,price:100,fx:32,prin:30000,avg:93.75},{_id:'bond',code:'00679B',name:'美國公債',cls:'債券',shares:100,price:30,fx:1,prin:3000,avg:30},{_id:'cash',code:'TWD',name:'台幣現金',cls:'現金',shares:5000,price:1,fx:1,prin:5000,avg:1},{_id:'loan',code:'LOAN',name:'房屋貸款',cls:'貸款',shares:-10000,price:1,fx:1,prin:-10000,avg:1});render();});
for(const width of [1440,768,390]){await page.setViewportSize({width,height:900});await page.screenshot({path:path.join(root,'work/trade-list-'+width+'.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
await page.locator('#hbody [aria-label="加碼"]').first().click();await page.locator('#a_shares').fill('200');await page.locator('#a_price').fill('97.3');await page.locator('#a_fee').fill('28');await page.screenshot({path:path.join(root,'work/trade-buy-'+width+'.png')});await page.getByRole('button',{name:'取消',exact:true}).click();}
await page.locator('#hbody [aria-label="更多操作"]').first().click();await page.getByRole('button',{name:'編輯部位',exact:true}).click();assert.equal(await page.locator('#blockEdit').isVisible(),true);await page.getByRole('button',{name:'取消',exact:true}).click();
await page.locator('#hbody [aria-label="更多操作"]').first().click();await page.locator('#extraDialog').getByRole('button',{name:'操作紀錄',exact:true}).click();assert.match(await page.locator('#auditList').textContent(),/手續費 28 TWD/);await page.evaluate(()=>setTab('hold'));
await page.evaluate(()=>{dca=[{code:'AAA',amt:1000}];openDCA('AAA');});await page.locator('#a_fee').fill('28');assert.match(await page.locator('#addPrev').innerText(),/1,000/);await page.locator('#saveBtn').click();assert.equal(await page.evaluate(()=>audit.at(-1).input.total),1000);assert.equal(await page.evaluate(()=>audit.at(-1).input.gross),972);
await page.evaluate(()=>openTrade(1));await page.locator('#a_shares').fill('2');await page.locator('#a_price').fill('100');await page.locator('#a_fee').fill('1.5');assert.match(await page.locator('#a_fee_label').innerText(),/USD/);assert.match(await page.locator('#addPrev').innerText(),/6,448/);await page.locator('#saveBtn').click();assert.equal(await page.evaluate(()=>audit.at(-1).input.feeTWD),48);
await page.evaluate(()=>openEdit(3));assert.equal(await page.locator('#tradeFee').isVisible(),false);await page.locator('#a_cash').fill('6000');await page.locator('#saveBtn').click();assert.equal(await page.evaluate(()=>data[3].shares),6000);
await page.evaluate(()=>{switchView('261101');});assert.equal(await page.locator('#hbody .position-actions').count(),0);
assert.deepEqual(errors,[]);console.log('PASS: icon actions, fee previews/save/reload/undo, FX, DCA, cash, history and responsive views');
}finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

