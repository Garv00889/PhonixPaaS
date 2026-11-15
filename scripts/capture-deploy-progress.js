const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const auth = require('../lib/auth');

const chromePath = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const tempDir = path.resolve(__dirname, '../.chrome-test-profile7');
fs.mkdirSync(tempDir, { recursive: true });

const browser = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--remote-debugging-port=9227',
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
      const res = await fetch('http://127.0.0.1:9227/json/version');
      const data = await res.json();
      if (data.webSocketDebuggerUrl) return data.webSocketDebuggerUrl;
    } catch (e) {}
  }
  throw new Error('Failed to connect to browser CDP port 9227');
}

async function run() {
  try {
    await getWsUrl();
    const user = auth.getUserByEmail('admin@phonixpaas.io');
    const token = auth.createSessionToken(user);

    const pageRes = await fetch('http://127.0.0.1:9227/json/new?about:blank', { method: 'PUT' });
    const pData = await pageRes.json();
    const ws = new WebSocket(pData.webSocketDebuggerUrl);
    let id = 1;
    const pending = new Map();
    ws.onmessage = e => {
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
    await send('Network.enable');
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Network.setCookie', {
      name: 'phonix_token',
      value: token,
      url: 'http://localhost:4000',
      domain: 'localhost',
      path: '/'
    });
    await send('Page.navigate', { url: 'http://localhost:4000/?deploy=true' });
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    await wait(2000);

    // Trigger deployment click via evaluate
    await send('Runtime.evaluate', {
      expression: `
        document.getElementById('depServiceName').value = 'screenshot-test-api';
        document.getElementById('depGitUrl').value = '';
        document.getElementById('btnRunDeploy').click();
      `
    });

    // Wait 1.2 seconds so progress steps are animating
    await wait(1200);

    const s = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.resolve(__dirname, '../phonix-deploy-progress.png'), Buffer.from(s.data, 'base64'));
    console.log('Saved phonix-deploy-progress.png');

    // Wait until deployment completes and cleans up
    await wait(2500);
    // Cleanup project from db
    try {
      await fetch('http://localhost:4000/api/projects/screenshot-test-api', {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` }
      });
    } catch(e) {}

    ws.close();
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
