const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function driveService(){
 const props={SYNC_TOKEN:'a'.repeat(64)};let content='',created=0,trashed=false,locks=0;
 const file={getId:()=> 'file',isTrashed:()=>trashed,getBlob:()=>({getDataAsString:()=>content}),setContent:s=>{content=s;}};
 const folder={getId:()=> 'folder',isTrashed:()=>false,getFilesByName:()=>({hasNext:()=>!!content,next:()=>file}),createFile:(n,s)=>{content=s;created++;return file;}};
 const c={PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k],setProperty:(k,v)=>{props[k]=v;}})},DriveApp:{getFileById:()=>file,getFolderById:()=>folder,createFolder:()=>folder},MimeType:{PLAIN_TEXT:'text/plain'},ContentService:{MimeType:{JSON:'application/json'},createTextOutput:s=>({setMimeType:()=>s})},LockService:{getScriptLock:()=>({waitLock(){locks++;},releaseLock(){locks--;}})}};
 vm.createContext(c);vm.runInContext(fs.readFileSync('sync-service/Code.gs','utf8'),c);
 return {call:r=>JSON.parse(c.doPost({postData:{contents:JSON.stringify(r)}})),get:()=>JSON.parse(c.doGet()),props,trash:()=>{trashed=true;},count:()=>created,locks:()=>locks};
}
const token='a'.repeat(64),payload={live:[{name:'測試持倉'}],audit:[],archives:{},notes:'測試筆記'};
test('Drive service authenticates before creating or reading files',()=>{const s=driveService();assert.equal(s.call({method:'readPortfolio',token:'wrong'}).ok,false);assert.equal(s.count(),0);assert.equal(s.get().payload,undefined);assert.equal(s.call({method:'info',token}).service,'stock-tracker-drive');assert.equal(s.count(),0);});
test('Drive saves Unicode and CAS rejects stale writes',()=>{const s=driveService();assert.equal(s.call({method:'readPortfolio',token}).revision,0);assert.equal(s.call({method:'savePortfolio',token,revision:0,payload}).revision,1);const conflict=s.call({method:'savePortfolio',token,revision:0,payload:{...payload,notes:'stale'}});assert.equal(conflict.conflict,true);assert.equal(s.call({method:'readPortfolio',token}).payload.notes,'測試筆記');assert.equal(s.count(),1);assert.equal(s.locks(),0);});
test('Drive refuses invalid data and missing/trash state cannot silently reset history',()=>{const s=driveService();assert.equal(s.call({method:'savePortfolio',token,revision:0,payload:{}}).ok,false);s.call({method:'readPortfolio',token});s.trash();assert.match(s.call({method:'readPortfolio',token}).error,/垃圾桶/);assert.equal(s.locks(),0);delete s.props.SYNC_TOKEN;assert.equal(s.call({method:'readPortfolio',token}).ok,false);});
