const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const chromePath = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const tempDir = path.resolve(__dirname, '../.chrome-test-profile4');
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

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  try {
    for (let i = 0; i < 20; i++) {
      await wait(500);
      try {
        const res = await fetch('http://127.0.0.1:9225/json/version');
        if ((await res.json()).webSocketDebuggerUrl) break;
      } catch (e) {}
    }

    const wsUrl = (await (await fetch('http://127.0.0.1:9225/json/version')).json()).webSocketDebuggerUrl;
    const browserWs = new WebSocket(wsUrl);
    let bid = 1;
    const bPending = new Map();
    browserWs.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id && bPending.has(msg.id)) {
        bPending.get(msg.id).resolve(msg.result);
      }
    };
    function bSend(method, params = {}) {
      return new Promise((resolve) => {
        const reqId = bid++;
        bPending.set(reqId, { resolve });
        browserWs.send(JSON.stringify({ id: reqId, method, params }));
      });
    }
    await new Promise(r => (browserWs.onopen = r));
    const target = await bSend('Target.createTarget', { url: 'http://localhost:4000/' });
    const list = await (await fetch('http://127.0.0.1:9225/json/list')).json();
    const pageTarget = list.find(t => t.id === target.targetId);
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
      if (msg.method === 'Runtime.consoleAPICalled') {
        console.log('[Console]', msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        console.error('[Exception]', JSON.stringify(msg.params.exceptionDetails));
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
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Page.navigate', { url: 'http://localhost:4000/' });
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    await wait(4000);

    const evalResult = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const iframe = document.getElementById('dashboardShaderIframe');
          return {
            iframeFound: !!iframe,
            iframeSrc: iframe ? iframe.src : null,
            iframeRect: iframe ? iframe.getBoundingClientRect() : null
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Eval:', evalResult.result.value);

    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('G:\\PhonixPaaS\\dash-check.png', Buffer.from(screenshot.data, 'base64'));
    ws.close();
  } finally {
    browser.kill();
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
  }
}

run().catch(e => { console.error(e); browser.kill(); process.exit(1); });
