const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const auth = require('../lib/auth');

const chromePath = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const tempDir = path.resolve(__dirname, '../.chrome-test-profile5');
fs.mkdirSync(tempDir, { recursive: true });

const browser = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--remote-debugging-port=9225',
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
      const res = await fetch('http://127.0.0.1:9225/json/version');
      const data = await res.json();
      if (data.webSocketDebuggerUrl) return data.webSocketDebuggerUrl;
    } catch (e) {}
  }
  throw new Error('Failed to connect to browser CDP port 9225');
}

async function capture(url, outFilename, setCookie = false) {
  const pageTargetRes = await fetch('http://127.0.0.1:9225/json/new?' + encodeURIComponent(url));
  const list = await (await fetch('http://127.0.0.1:9225/json/list')).json();
  const pageTarget = list.find(t => t.url.includes(url) || t.title);
  
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
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
  await new Promise(r => (ws.onopen = r));
  await send('Page.enable');
  await send('Network.enable');

  if (setCookie) {
    const user = auth.getUserByEmail('admin@phonixpaas.io');
    const token = auth.createSessionToken(user);
    await send('Network.setCookie', {
      name: 'phonix_token',
      value: token,
      domain: 'localhost',
      path: '/'
    });
  }

  await send('Page.navigate', { url });
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await wait(2200);

  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  const outPath = path.resolve(__dirname, '..', outFilename);
  fs.writeFileSync(outPath, Buffer.from(screenshot.data, 'base64'));
  console.log(`Saved screenshot of ${url} to ${outPath}`);
  ws.close();
}

async function run() {
  try {
    await getWsUrl();
    console.log('Capturing Landing Page (/)...');
    await capture('http://localhost:4000/', 'phonix-landing.png');

    console.log('Capturing Login Page (/login)...');
    await capture('http://localhost:4000/login', 'phonix-login.png');

    console.log('Capturing Authenticated Dashboard (/dashboard)...');
    await capture('http://localhost:4000/dashboard', 'phonix-dashboard.png', true);

    console.log('All screenshots captured successfully.');
  } finally {
    browser.kill();
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
  }
}

run().catch(e => {
  console.error(e);
  browser.kill();
  process.exit(1);
});
