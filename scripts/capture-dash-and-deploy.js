const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const auth = require('../lib/auth');

const chromePath = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const tempDir = path.resolve(__dirname, '../.chrome-test-profile6');
fs.mkdirSync(tempDir, { recursive: true });

const browser = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--remote-debugging-port=9226',
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
      const res = await fetch('http://127.0.0.1:9226/json/version');
      const data = await res.json();
      if (data.webSocketDebuggerUrl) return data.webSocketDebuggerUrl;
    } catch (e) {}
  }
  throw new Error('Failed to connect to browser CDP port 9226');
}

async function run() {
  try {
    await getWsUrl();
    const user = auth.getUserByEmail('admin@phonixpaas.io');
    const token = auth.createSessionToken(user);

    // 1. Capture Dashboard with authentication
    const page1Res = await fetch('http://127.0.0.1:9226/json/new?about:blank', { method: 'PUT' });
    const p1Data = await page1Res.json();
    const ws1 = new WebSocket(p1Data.webSocketDebuggerUrl);
    let id1 = 1;
    const pending1 = new Map();
    ws1.onmessage = e => {
      const msg = JSON.parse(e.data);
      if (msg.id && pending1.has(msg.id)) {
        const { resolve, reject } = pending1.get(msg.id);
        pending1.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
    function send1(method, params = {}) {
      return new Promise((resolve, reject) => {
        const reqId = id1++;
        pending1.set(reqId, { resolve, reject });
        ws1.send(JSON.stringify({ id: reqId, method, params }));
      });
    }
    await new Promise(r => ws1.onopen = r);
    await send1('Network.enable');
    await send1('Page.enable');
    await send1('Network.setCookie', {
      name: 'phonix_token',
      value: token,
      url: 'http://localhost:4000',
      domain: 'localhost',
      path: '/'
    });
    await send1('Page.navigate', { url: 'http://localhost:4000/dashboard' });
    await send1('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    await wait(3000);

    const s1 = await send1('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.resolve(__dirname, '../phonix-dashboard.png'), Buffer.from(s1.data, 'base64'));
    console.log('Saved phonix-dashboard.png');
    ws1.close();

    // 2. Capture Deploy Modal on landing page
    const page2Res = await fetch('http://127.0.0.1:9226/json/new?about:blank', { method: 'PUT' });
    const p2Data = await page2Res.json();
    const ws2 = new WebSocket(p2Data.webSocketDebuggerUrl);
    let id2 = 1;
    const pending2 = new Map();
    ws2.onmessage = e => {
      const msg = JSON.parse(e.data);
      if (msg.id && pending2.has(msg.id)) {
        const { resolve, reject } = pending2.get(msg.id);
        pending2.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
    function send2(method, params = {}) {
      return new Promise((resolve, reject) => {
        const reqId = id2++;
        pending2.set(reqId, { resolve, reject });
        ws2.send(JSON.stringify({ id: reqId, method, params }));
      });
    }
    await new Promise(r => ws2.onopen = r);
    await send2('Network.enable');
    await send2('Page.enable');
    await send2('Network.setCookie', {
      name: 'phonix_token',
      value: token,
      url: 'http://localhost:4000',
      domain: 'localhost',
      path: '/'
    });
    await send2('Page.navigate', { url: 'http://localhost:4000/?deploy=true' });
    await send2('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    await wait(2500);

    const s2 = await send2('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.resolve(__dirname, '../phonix-deploy-modal.png'), Buffer.from(s2.data, 'base64'));
    console.log('Saved phonix-deploy-modal.png');
    ws2.close();

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
