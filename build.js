// node build.js → index.html (GitHub Pages용 완성본, 랭킹 서버 연결), dist/mine.html (아티팩트, 서버 없이)
const fs = require('fs');
const core = fs.readFileSync(__dirname + '/src/engine.js', 'utf8');
const ui = fs.readFileSync(__dirname + '/src/ui.html', 'utf8');
const cfg = JSON.parse(fs.readFileSync(__dirname + '/config.json', 'utf8'));
const withCore = ui.replace('<!--CORE-->', () => '<script id="core">\n' + core + '\n</script>');
const body = withCore.replace("'__SERVER_URL__'", JSON.stringify(process.env.SERVER != null ? process.env.SERVER : (cfg.server || '')));
const artifact = withCore.replace("'__SERVER_URL__'", "''"); // 아티팩트는 다른 서버에 접속할 수 없음
fs.mkdirSync(__dirname + '/dist', { recursive: true });
fs.writeFileSync(__dirname + '/dist/mine.html', artifact);
const head = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="마우스를 바위 위에 올려 두고 캐는 판타지 광산 게임. 광석으로 스킬 트리를 열고 곡괭이를 만들어 가장 깊은 곳의 광산의 심장을 깨세요. 클리어 시간 랭킹.">
<meta property="og:title" content="한판 광산">
<meta property="og:description" content="돌부터 별철까지, 광산의 심장을 누가 가장 빨리 깰까요?">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#1c1714"/><path d="M5 11c6-5 16-5 22 0" fill="none" stroke="#f2a541" stroke-width="3.4" stroke-linecap="round"/><path d="M16 9v19" stroke="#c48a52" stroke-width="3.6" stroke-linecap="round"/></svg>')}">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);box-sizing:border-box}body{margin:0;font:14px system-ui,sans-serif}[hidden]{display:none!important}img{max-width:100%}</style>
`;
const cut = body.indexOf('</style>') + 8;
fs.writeFileSync(__dirname + '/index.html', head + body.slice(0, cut) + '\n</head>\n<body>\n' + body.slice(cut) + '\n</body>\n</html>\n');
console.log('index.html', fs.statSync(__dirname + '/index.html').size, 'bytes / dist/mine.html', fs.statSync(__dirname + '/dist/mine.html').size, 'bytes');
