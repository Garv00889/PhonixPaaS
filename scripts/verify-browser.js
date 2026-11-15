const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const tempDir = path.resolve(__dirname, '../.chrome-test-profile');
fs.mkdirSync(tempDir, { recursive: true });

console.log('Launching browser:', chromePath);
const browser = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--remote-debugging-port=9222',
  `--user-data-dir=${tempDir}`,
  '--no-first-run',
  '--no-default-browser-check',
  'about:blank'
]);

browser.stderr.on('data', d => {
  // console.log('[browser]', d.toString());
});

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function getWsUrl() {
  for (let i = 0; i < 20; i++) {
    await wait(500);
    try {
      const res = await fetch('http://127.0.0.1:9222/json/version');
      const data = await res.json();
      if (data.webSocketDebuggerUrl) return data.webSocketDebuggerUrl;
    } catch (e) {}
  }
  throw new Error('Failed to connect to browser CDP port 9222');
}

async function run() {
  try {
    const wsUrl = await getWsUrl();
    console.log('Connected to browser via CDP:', wsUrl);

    // Connect to browser target first
    const browserWs = new WebSocket(wsUrl);
    let bid = 1;
    const bPending = new Map();
    browserWs.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id && bPending.has(msg.id)) {
        const { resolve, reject } = bPending.get(msg.id);
        bPending.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
    function bSend(method, params = {}) {
      return new Promise((resolve, reject) => {
        const reqId = bid++;
        bPending.set(reqId, { resolve, reject });
        browserWs.send(JSON.stringify({ id: reqId, method, params }));
      });
    }
    await new Promise(r => (browserWs.onopen = r));
    const target = await bSend('Target.createTarget', { url: 'http://localhost:4000/scene/' });
    console.log('Target created:', target.targetId);

    // Get list of targets
    const listRes = await fetch('http://127.0.0.1:9222/json/list');
    const list = await listRes.json();
    const pageTarget = list.find(t => t.id === target.targetId);
    console.log('Page target found:', pageTarget.url);

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

    let id = 1;
    const pending = new Map();

    let iframeContextId = null;
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
      if (msg.method === 'Runtime.executionContextCreated') {
        const ctx = msg.params.context;
        console.log('[Execution Context Created]', ctx.id, ctx.name, ctx.origin);
        if (ctx.name !== '') {
          iframeContextId = ctx.id;
        } else if (ctx.origin === 'null' || !ctx.origin.includes('localhost')) {
          iframeContextId = ctx.id;
        }
      }
      if (msg.method === 'Runtime.consoleAPICalled') {
        console.log('[Browser Console]', msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        console.error('[Browser Exception]', JSON.stringify(msg.params.exceptionDetails));
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
    console.log('WebSocket open, enabling domains...');
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });

    console.log('Waiting 3 seconds for rendering & particle simulation...');
    await wait(3000);

    // Evaluate DOM structure
    const domInfo = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const root = document.getElementById('root');
          const shaderFrame = document.querySelector('.shader-frame');
          const iframe = document.querySelector('iframe');
          let iframeDetails = null;
          if (iframe) {
            try {
              const doc = iframe.contentDocument || iframe.contentWindow.document;
              const canvas = doc ? doc.querySelector('canvas') : null;
              iframeDetails = {
                title: iframe.title,
                sandbox: iframe.getAttribute('sandbox'),
                hasCanvas: !!canvas,
                canvasWidth: canvas ? canvas.width : null,
                canvasHeight: canvas ? canvas.height : null
              };
            } catch (e) {
              iframeDetails = { error: e.message };
            }
          }
          let iframeBounds = null;
          if (iframe) {
            const rect = iframe.getBoundingClientRect();
            iframeBounds = { width: rect.width, height: rect.height, top: rect.top, left: rect.left };
          }
          return {
            title: document.title,
            hasRoot: !!root,
            hasShaderFrame: !!shaderFrame,
            hasIframe: !!iframe,
            iframeBounds,
            rootBounds: root ? { width: root.getBoundingClientRect().width, height: root.getBoundingClientRect().height } : null
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Page DOM State:', JSON.stringify(domInfo.result.value, null, 2));

    if (iframeContextId) {
      try {
        const iframeEval = await send('Runtime.evaluate', {
          contextId: iframeContextId,
          expression: `
            (() => {
              const canvas = document.querySelector('canvas');
              const controls = window.__SF_CONTROLS;
              return {
                canvasFound: !!canvas,
                canvasWidth: canvas ? canvas.width : null,
                canvasHeight: canvas ? canvas.height : null,
                controls,
                bodyBg: getComputedStyle(document.body).backgroundColor
              };
            })()
          `,
          returnByValue: true
        });
        console.log('Iframe Internal State:', JSON.stringify(iframeEval.result.value, null, 2));
      } catch (err) {
        console.log('Iframe eval error (expected with sandboxed iframe):', err.message || err);
      }
    }

    // Capture screenshot
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    const screenshotPath = path.resolve(__dirname, '../scene-screenshot.png');
    fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
    console.log('Screenshot saved to:', screenshotPath, `(${Buffer.from(screenshot.data, 'base64').length} bytes)`);

    ws.close();
  } finally {
    browser.kill();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

run().catch(err => {
  console.error('Error during verification:', err);
  browser.kill();
  process.exit(1);
});
