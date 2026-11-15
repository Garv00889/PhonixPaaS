const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tempDir = path.resolve(__dirname, '../.chrome-test-profile5');
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

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  try {
    for (let i = 0; i < 20; i++) {
      await wait(500);
      try {
        const res = await fetch('http://127.0.0.1:9226/json/version');
        if ((await res.json()).webSocketDebuggerUrl) break;
      } catch (e) {}
    }

    const wsUrl = (await (await fetch('http://127.0.0.1:9226/json/version')).json()).webSocketDebuggerUrl;
    const browserWs = new WebSocket(wsUrl);
    let bid = 1;
    const bPending = new Map();
    browserWs.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id && bPending.has(msg.id)) bPending.get(msg.id).resolve(msg.result);
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
    const list = await (await fetch('http://127.0.0.1:9226/json/list')).json();
    const pageTarget = list.find(t => t.id === target.targetId);
    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

    let id = 1;
    const pending = new Map();
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id && pending.has(msg.id)) pending.get(msg.id).resolve(msg.result);
    };
    function send(method, params = {}) {
      return new Promise((resolve) => {
        const reqId = id++;
        pending.set(reqId, { resolve });
        ws.send(JSON.stringify({ id: reqId, method, params }));
      });
    }
    await new Promise(r => (ws.onopen = r));
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Page.navigate', { url: 'http://localhost:4000/' });
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    await wait(3500);

    const evalResult = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const bgDiv = document.getElementById('website-animation-bg');
          const iframe = document.getElementById('globalBgShaderIframe');
          const layout = document.querySelector('.render-layout');
          const wrapper = document.querySelector('.rd-main-wrapper');
          const body = document.body;
          const html = document.documentElement;

          return {
            bgDiv: bgDiv ? { zIndex: getComputedStyle(bgDiv).zIndex, rect: bgDiv.getBoundingClientRect() } : null,
            iframe: iframe ? { src: iframe.src, rect: iframe.getBoundingClientRect() } : null,
            layoutBg: layout ? getComputedStyle(layout).backgroundColor : null,
            wrapperBg: wrapper ? getComputedStyle(wrapper).backgroundColor : null,
            bodyBg: getComputedStyle(body).backgroundColor,
            htmlBg: getComputedStyle(html).backgroundColor
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Styles check:', JSON.stringify(evalResult.result.value, null, 2));
    ws.close();
  } finally {
    browser.kill();
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
  }
}

run().catch(e => { console.error(e); browser.kill(); process.exit(1); });
