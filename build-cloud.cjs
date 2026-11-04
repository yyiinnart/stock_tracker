const fs=require('node:fs');
let html=fs.readFileSync('index.html','utf8');
for(const file of ['portfolio-core.js','enhancements.js','cloud-sync.js'])html=html.replace(`<script src="${file}"></script>`,()=>`<script>\n${fs.readFileSync(file,'utf8')}\n</script>`);
fs.writeFileSync('apps-script/Index.html',html);
console.log('已產生 apps-script/Index.html');
