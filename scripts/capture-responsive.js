const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const chromePath = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const tempDir = path.resolve(__dirname, '../.chrome-test-profile-resp');
fs.mkdirSync(tempDir, { recursive: true });

const browser = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--remote-debugging-port=9223',
  `--user-data-dir=${tempDir}`,
  '--no-first-run',
  '--no-default-browser-check',
  'about:blank'
]);

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function getWsUrl() {
  for (let i = 0; i < 20; i++) {
    await wait(500);
    try {
      const res = await fetch('http://127.0.0.1:9223/json/version');
      const data = await res.json();
      if (data.webSocketDebuggerUrl) return data.webSocketDebuggerUrl;
    } catch (e) {}
  }
  throw new Error('Failed to connect to browser CDP port 9223');
}

async function captureView(url, width, height, topOut, fullOut) {
  const pageRes = await fetch('http://127.0.0.1:9223/json/new?' + encodeURIComponent(url), { method: 'PUT' });
  const pageData = await pageRes.json();
  
  const ws = new WebSocket(pageData.webSocketDebuggerUrl);
  let id = 1;
  const pending = new Map();
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  };
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const reqId = id++;
      pending.set(reqId, { resolve, reject });
      ws.send(JSON.stringify({ id: reqId, method, params }));
    });
  }

  await new Promise(r => ws.onopen = r);
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 2,
    mobile: width < 800
  });

  await wait(3000);

  // Top viewport screenshot
  const topSnap = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(__dirname, '../' + topOut), Buffer.from(topSnap.data, 'base64'));

  // Full page screenshot
  const fullSnap = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  fs.writeFileSync(path.resolve(__dirname, '../' + fullOut), Buffer.from(fullSnap.data, 'base64'));

  ws.close();
}

async function run() {
  await getWsUrl();
  console.log('Capturing mobile view (390x844)...');
  await captureView('http://localhost:4000/', 390, 844, 'phonix-mobile-top.png', 'phonix-mobile-full.png');

  console.log('Capturing tablet view (768x1024)...');
  await captureView('http://localhost:4000/', 768, 1024, 'phonix-tablet-top.png', 'phonix-tablet-full.png');

  browser.kill();
  console.log('Finished capturing responsive screenshots.');
}

run().catch(err => {
  console.error(err);
  try { browser.kill(); } catch (e) {}
  process.exit(1);
});
