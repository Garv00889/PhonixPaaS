const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/jayes/.gemini/antigravity/brain/48616ef5-0bbe-49f8-b660-fa49c6cdd0c0';
const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9222;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getAdminToken() {
  try {
    const res = await fetch('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@phonixpaas.io',
        password: 'AdminPassword2026!'
      })
    });
    const data = await res.json();
    return data.token;
  } catch (err) {
    console.error('Error logging in:', err);
    return null;
  }
}

function launchChrome() {
  const chromeProcess = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-background-networking',
    '--user-data-dir=C:/temp/chrome-test-profile-' + Date.now()
  ], { stdio: 'ignore' });

  return chromeProcess;
}

async function waitForCdp() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) {
        const json = await res.json();
        return json.webSocketDebuggerUrl;
      }
    } catch (e) {}
    await sleep(250);
  }
  throw new Error('Chrome CDP failed to start on port ' + PORT);
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 1;
    this.pending = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function createTarget() {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/new?http://localhost:4000/`, { method: 'PUT' });
  const data = await res.json();
  return data.webSocketDebuggerUrl;
}

async function captureView(client, { width, height, isMobile, url, cookie, outputPath }) {
  console.log(`Capturing ${url} (${width}x${height}, mobile: ${isMobile}) -> ${path.basename(outputPath)}`);
  
  await client.send('Page.enable');
  await client.send('Network.enable');

  if (cookie) {
    await client.send('Network.setCookie', {
      name: 'phonix_token',
      value: cookie,
      domain: 'localhost',
      path: '/'
    });
  }

  await client.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 2,
    mobile: isMobile
  });

  await client.send('Page.navigate', { url });
  await sleep(1800);

  // Force reveal of any scroll-reveal elements
  await client.send('Runtime.evaluate', {
    expression: `
      document.querySelectorAll('.scroll-reveal').forEach(el => {
        el.classList.add('revealed');
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
    `
  });
  await sleep(300);

  const screenshot = await client.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false
  });

  const buffer = Buffer.from(screenshot.data, 'base64');
  fs.writeFileSync(outputPath, buffer);
  console.log(`Saved: ${outputPath} (${buffer.length} bytes)`);
}

async function main() {
  console.log('Obtaining auth token...');
  const token = await getAdminToken();
  console.log('Auth token:', token ? 'OK' : 'FAILED');

  console.log('Launching Headless Chrome...');
  const chrome = launchChrome();

  try {
    const wsUrl = await waitForCdp();
    console.log('CDP Ready:', wsUrl);

    const targetWsUrl = await createTarget();
    const client = new CdpClient(targetWsUrl);
    await client.connect();

    // 1. Landing Desktop
    await captureView(client, {
      width: 1280,
      height: 800,
      isMobile: false,
      url: 'http://localhost:4000/',
      cookie: null,
      outputPath: path.join(ARTIFACT_DIR, 'landing-noir-desktop.png')
    });

    // 2. Landing Mobile
    await captureView(client, {
      width: 390,
      height: 844,
      isMobile: true,
      url: 'http://localhost:4000/',
      cookie: null,
      outputPath: path.join(ARTIFACT_DIR, 'landing-noir-mobile.png')
    });

    // 3. Login Desktop
    await captureView(client, {
      width: 1280,
      height: 800,
      isMobile: false,
      url: 'http://localhost:4000/login?force=1',
      cookie: null,
      outputPath: path.join(ARTIFACT_DIR, 'login-noir-desktop.png')
    });

    // 4. Login Mobile
    await captureView(client, {
      width: 390,
      height: 844,
      isMobile: true,
      url: 'http://localhost:4000/login?force=1',
      cookie: null,
      outputPath: path.join(ARTIFACT_DIR, 'login-noir-mobile.png')
    });

    // 5. Dashboard Desktop (Authenticated)
    await captureView(client, {
      width: 1280,
      height: 800,
      isMobile: false,
      url: 'http://localhost:4000/dashboard',
      cookie: token,
      outputPath: path.join(ARTIFACT_DIR, 'dashboard-noir-desktop.png')
    });

    // 6. Dashboard Mobile (Authenticated)
    await captureView(client, {
      width: 390,
      height: 844,
      isMobile: true,
      url: 'http://localhost:4000/dashboard',
      cookie: token,
      outputPath: path.join(ARTIFACT_DIR, 'dashboard-noir-mobile.png')
    });

    client.close();
    console.log('All 6 Red Noir responsive screenshots captured successfully!');
  } finally {
    chrome.kill('SIGKILL');
  }
}

main().catch(err => {
  console.error('Fatal error in capture script:', err);
  process.exit(1);
});
