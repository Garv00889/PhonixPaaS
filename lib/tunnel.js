const { spawn, exec } = require('child_process');
const db = require('./db');

let tunnelProcess = null;
let currentPublicUrl = null;

function checkCloudflaredInstalled() {
  return new Promise((resolve) => {
    exec('cloudflared --version', (err, stdout) => {
      if (err || !stdout) {
        resolve({ installed: false, version: null });
      } else {
        resolve({ installed: true, version: stdout.trim() });
      }
    });
  });
}

function startQuickTunnel(targetPort = 4000) {
  return new Promise(async (resolve, reject) => {
    const check = await checkCloudflaredInstalled();
    if (!check.installed) {
      return resolve({
        active: false,
        url: null,
        error: 'cloudflared is not installed. Run "pkg install cloudflared" on Termux.'
      });
    }

    if (tunnelProcess) {
      stopTunnel();
    }

    // Launch quick trycloudflare tunnel
    tunnelProcess = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${targetPort}`]);
    let resolved = false;

    tunnelProcess.stderr.on('data', (data) => {
      const output = data.toString();
      // Look for *.trycloudflare.com url
      const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
      if (match && !resolved) {
        resolved = true;
        currentPublicUrl = match[0];
        resolve({ active: true, url: currentPublicUrl });
      }
    });

    tunnelProcess.on('close', () => {
      tunnelProcess = null;
      currentPublicUrl = null;
    });

    tunnelProcess.on('error', (err) => {
      tunnelProcess = null;
      currentPublicUrl = null;
      if (!resolved) {
        resolved = true;
        resolve({ active: false, url: null, error: err.message });
      }
    });

    // Timeout if url not discovered in 15 seconds
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({ active: false, url: null, error: 'Tunnel setup timed out.' });
      }
    }, 15000);
  });
}

function stopTunnel() {
  if (tunnelProcess) {
    tunnelProcess.kill();
    tunnelProcess = null;
    currentPublicUrl = null;
  }
}

function getTunnelStatus() {
  return {
    active: Boolean(tunnelProcess),
    url: currentPublicUrl
  };
}

module.exports = {
  checkCloudflaredInstalled,
  startQuickTunnel,
  stopTunnel,
  getTunnelStatus
};
