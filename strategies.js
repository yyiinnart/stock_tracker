/* Strategy controls share the app's dialogs, typography and palette. */
function actionMenu(label,content){return `<details class="action-menu"><summary aria-label="${escapeIncomeText(label)}" title="${escapeIncomeText(label)}">⋯</summary><div class="action-menu-items">${content}</div></details>`;}
function strategyGroup(id){return strategies.groups.find(g=>g.id===StrategyCore.groupId(id));}
function groupLabel(id){return strategyGroup(id)?.name||'未分類';}
function strategyOptions(selected,all=false){return (all?'<option value="all">全部板塊</option>':'')+'<option value="unclassified"'+(!selected||selected==='unclassified'?' selected':'')+'>未分類</option>'+strategies.groups.map(g=>`<option value="${g.id}" ${g.id===selected?'selected':''}>${escapeIncomeText(g.name)}</option>`).join('');}
let yieldGroupId='b2',strategyGroupId='b1';
const yieldGroupOrder=['all','b1','b2','b3','b4','unclassified'];
function stepYieldGroup(delta){yieldGroupId=yieldGroupOrder[(yieldGroupOrder.indexOf(yieldGroupId)+delta+yieldGroupOrder.length)%yieldGroupOrder.length];renderYield();}
function stepStrategyGroup(delta){const ids=strategies.groups.map(g=>g.id);strategyGroupId=ids[(ids.indexOf(strategyGroupId)+delta+ids.length)%ids.length];renderStrat();}
function refreshGroupFilter(){const el=document.getElementById('yieldGroup');if(el){el.textContent=yieldGroupId==='all'?'全部板塊':groupLabel(yieldGroupId);el.dataset.group=yieldGroupId;}}

function verdict(y){const g=strategyGroup(y?.g),v=yldOf(y);if(!g||g.id==='b1'||v==null)return null;const r=g.rules.find(r=>StrategyCore.match(r,v));return r?{cls:'v-hold',text:r.action,description:r.description}:null;}
function ruleThreshold(r){return r.op==='between'?`${r.value}% ～ ${r.upper}%（含端點）`:`${{lt:'<',lte:'≤',gt:'>',gte:'≥'}[r.op]} ${r.value}%`;}
function renderStrat(){
 const host=document.getElementById('strategyGroupContent');if(!host)return;
 host.innerHTML=strategies.groups.filter(g=>g.id===strategyGroupId).map(g=>{
  const menu=actionMenu(g.name+'操作',`<button onclick="editStrategyGroup('${g.id}')">編輯板塊${g.id==='b1'?'名稱':'與規則'}</button>${g.id==='b1'?'<button onclick="editStrategyCard(-1)">新增策略卡</button>':''}`);
  document.getElementById('strategyGroupLabel').textContent=g.name;
  document.getElementById('strategyGroupActions').innerHTML=menu;
  const body=g.id==='b1'?g.cards.map((c,i)=>`<section class="strategy-card"><div class="strategy-card-heading"><button class="strategy-fold" aria-expanded="${!c.collapsed}" onclick="toggleStrategyCard(${i})">${c.collapsed?'▸':'▾'} ${escapeIncomeText(c.title||'未命名策略')}</button>${actionMenu('策略卡操作',`<button onclick="editStrategyCard(${i})">改名與編輯</button><button class="btn danger" onclick="deleteStrategyCard(${i})">刪除策略卡</button>`)}</div>${!c.collapsed?`<p class="strategy-content">${escapeIncomeText(c.content)||'<span class="muted">空白</span>'}</p>`:''}</section>`).join('')||'<p class="muted">尚無策略卡</p>':g.rules.map(r=>`<div class="strategy-rule"><strong>${escapeIncomeText(r.action)}</strong><span class="strategy-threshold">${escapeIncomeText(ruleThreshold(r))}</span><p>${escapeIncomeText(r.description)}</p></div>`).join('')||'<p class="muted">尚無規則</p>';
  return `<section class="strategy-group" data-group="${g.id}" aria-label="${escapeIncomeText(g.name)}">${body}${g.note?`<p class="strategy-content muted">${escapeIncomeText(g.note)}</p>`:''}</section>`;
 }).join('');
}
function saveStrategyData(){StrategyCore.validate(strategies);save();persistNow();refreshGroupFilter();renderYield();refreshAiPreview();}
function toggleStrategyCard(i){const c=strategies.groups[0].cards[i];c.collapsed=!c.collapsed;saveStrategyData();}
function deleteStrategyCard(i){if(!confirm('刪除這張策略卡？此操作無法復原。'))return;strategies.groups[0].cards.splice(i,1);saveStrategyData();}
function editStrategyCard(i){const c=strategies.groups[0].cards[i];openExtra(c?'編輯策略卡':'新增策略卡',`<div class="fg"><label for="strategyCardTitle">名稱</label><input id="strategyCardTitle" value="${escapeIncomeText(c?.title||'')}"></div><div class="fg"><label for="strategyCardContent">內容</label><textarea id="strategyCardContent" rows="10">${escapeIncomeText(c?.content||'')}</textarea></div><button class="btn primary" onclick="saveStrategyCard(${i})">儲存</button>`);}
function saveStrategyCard(i){const title=document.getElementById('strategyCardTitle').value.trim(),content=document.getElementById('strategyCardContent').value;if(!title){alert('請填寫策略卡名稱');return;}const cards=strategies.groups[0].cards;if(i<0)cards.push({id:crypto.randomUUID(),title,content,collapsed:false});else{Object.assign(cards[i],{title,content});if(cards[i].id==='legacy-notes')notes=content;}document.getElementById('extraDialog').close();saveStrategyData();}
function strategyRuleEditor(r={action:'',op:'gte',value:'',upper:'',description:''}){return `<fieldset class="strategy-rule-editor"><legend>殖利率規則</legend><label>行動<input data-field="action" value="${escapeIncomeText(r.action)}"></label><div class="strategy-rule-inputs"><label>比較<select data-field="op" onchange="this.closest('fieldset').querySelector('[data-upper]').hidden=this.value!=='between'">${[['lt','小於'],['lte','小於或等於'],['gt','大於'],['gte','大於或等於'],['between','區間（含端點）']].map(([v,n])=>`<option value="${v}" ${r.op===v?'selected':''}>${n}</option>`).join('')}</select></label><label>殖利率（%）<input data-field="value" type="number" min="0" step="any" value="${r.value}"></label><label data-upper ${r.op==='between'?'':'hidden'}>上限（%）<input data-field="upper" type="number" min="0" step="any" value="${r.upper??''}"></label></div><label>說明<textarea data-field="description" rows="2">${escapeIncomeText(r.description)}</textarea></label>${actionMenu('此規則操作','<button class="btn danger" onclick="this.closest(\'fieldset\').remove()">移除規則</button>')}</fieldset>`;}
function editStrategyGroup(id){const g=strategyGroup(id);openExtra('編輯操作策略',`<div class="fg"><label for="strategyGroupName">板塊名稱</label><input id="strategyGroupName" value="${escapeIncomeText(g.name)}"></div>${id==='b1'?'':`<p class="muted">依排列順序採用第一條符合的殖利率規則；其他條件僅作說明，需自行確認。</p><div id="strategyRules">${g.rules.map(strategyRuleEditor).join('')}</div><button class="text-btn" onclick="document.getElementById('strategyRules').insertAdjacentHTML('beforeend',strategyRuleEditor())">新增規則</button><div class="fg"><label for="strategyGroupNote">備註</label><textarea id="strategyGroupNote" rows="3">${escapeIncomeText(g.note)}</textarea></div>`}<div><button class="btn primary" onclick="saveStrategyGroup('${id}')">儲存</button></div>`);}
function saveStrategyGroup(id){
 const name=document.getElementById('strategyGroupName').value.trim();if(!name){alert('請填寫板塊名稱');return;}
 const next=clone(strategies),g=next.groups.find(g=>g.id===id);g.name=name;
 if(id!=='b1'){
  const fields=[...document.querySelectorAll('#strategyRules fieldset')];
  if(fields.some(el=>el.querySelector('[data-field=value]').value.trim()===''||(el.querySelector('[data-field=op]').value==='between'&&el.querySelector('[data-field=upper]').value.trim()===''))){alert('請填寫殖利率門檻');return;}
  g.rules=fields.map(el=>{const val=k=>el.querySelector(`[data-field=${k}]`).value;return {action:val('action').trim(),op:val('op'),value:Number(val('value')),upper:val('op')==='between'?Number(val('upper')):null,description:val('description')};});g.note=document.getElementById('strategyGroupNote').value;
 }
 try{StrategyCore.validate(next);}catch(e){alert(e.message);return;}strategies=next;document.getElementById('extraDialog').close();saveStrategyData();
}
// Details menus stay keyboard accessible and close on Escape or outside click.
document.addEventListener('click',e=>{document.querySelectorAll('.action-menu[open]').forEach(menu=>{if(!menu.contains(e.target)||e.target.closest('button'))menu.open=false;});});
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.action-menu[open]').forEach(menu=>{menu.open=false;menu.querySelector('summary').focus();e.preventDefault();e.stopImmediatePropagation();});},true);
