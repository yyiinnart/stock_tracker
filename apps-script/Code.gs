/* Deploy this project as a Web App: Execute as me, Who has access: Only myself. */
function ownerOnly_(){const active=Session.getActiveUser().getEmail();const owner=Session.getEffectiveUser().getEmail();if(!active||active!==owner)throw Error('僅限部署者本人登入使用');}
function doGet(){ownerOnly_();return HtmlService.createHtmlOutputFromFile('Index').setTitle('StockTracker').addMetaTag('viewport','width=device-width, initial-scale=1');}
function storeSheet_(){
  const props=PropertiesService.getScriptProperties();let id=props.getProperty('PORTFOLIO_SHEET_ID');
  if(!id){const book=SpreadsheetApp.create('StockTracker 私人同步資料');id=book.getId();props.setProperty('PORTFOLIO_SHEET_ID',id);}
  const book=SpreadsheetApp.openById(id);return book.getSheetByName('State')||book.insertSheet('State');
}
function readState_(sheet){
  if(!sheet.getLastRow())return {revision:0,payload:null,updatedAt:null};
  const values=sheet.getRange(1,1,sheet.getLastRow(),1).getValues().flat().join('');
  return JSON.parse(Utilities.newBlob(Utilities.base64Decode(values)).getDataAsString('UTF-8'));
}
function readPortfolio(){ownerOnly_();const lock=LockService.getScriptLock();lock.waitLock(20000);try{return readState_(storeSheet_());}finally{lock.releaseLock();}}
function savePortfolio(expectedRevision,payload){
  ownerOnly_();
  if(!Number.isInteger(expectedRevision)||expectedRevision<0||!payload||!Array.isArray(payload.live)||!Array.isArray(payload.audit))throw Error('同步資料格式不正確');
  const json=JSON.stringify(payload);if(json.length>4000000)throw Error('資料超過同步容量，請先匯出並整理歷史快照');
  const lock=LockService.getScriptLock();lock.waitLock(20000);
  try{
    const sheet=storeSheet_(),current=readState_(sheet);
    if(current.revision!==expectedRevision)return Object.assign({conflict:true},current);
    const next={revision:current.revision+1,updatedAt:new Date().toISOString(),payload:payload};
    // Base64 prevents spreadsheet formula interpretation and preserves Unicode.
    const encoded=Utilities.base64Encode(JSON.stringify(next),Utilities.Charset.UTF_8);
    const chunks=encoded.match(/.{1,40000}/g).map(s=>[s]);
    const count=Math.max(chunks.length,sheet.getLastRow());while(chunks.length<count)chunks.push(['']);
    if(sheet.getMaxRows()<count)sheet.insertRowsAfter(sheet.getMaxRows(),count-sheet.getMaxRows());
    sheet.getRange(1,1,count,1).setValues(chunks);SpreadsheetApp.flush();
    return {revision:next.revision,updatedAt:next.updatedAt};
  }finally{lock.releaseLock();}
}
