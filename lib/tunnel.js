const { spawn, exec } = require('child_process');
const db = require('./db');

let tunnelProcess = null;
let currentPublicUrl = null;
let tunnelType = 'OFF';

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
  return new Promise(async (resolve) => {
    const check = await checkCloudflaredInstalled();
    if (!check.installed) {
      // In dev environment or if cloudflared is not in PATH, provide a realistic simulated preview
      currentPublicUrl = `https://phonix-node-${Math.random().toString(36).substring(2, 8)}.trycloudflare.com`;
      tunnelType = 'SIMULATED';
      db.logActivity({
        type: 'NETWORK',
        title: 'Cloudflare Tunnel Active (Dev Mode)',
        message: `Simulated tunnel generated at ${currentPublicUrl}. Install cloudflared for live edge routing.`,
        status: 'SUCCESS'
      });
      return resolve({
        active: true,
        url: currentPublicUrl,
        mode: 'simulated',
        notice: 'cloudflared binary not found in PATH. Displaying dev preview.'
      });
    }

    if (tunnelProcess) {
      stopTunnel();
    }

    tunnelType = 'QUICK';
    tunnelProcess = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${targetPort}`]);
    let resolved = false;

    tunnelProcess.stderr.on('data', (data) => {
      const output = data.toString();
      const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
      if (match && !resolved) {
        resolved = true;
        currentPublicUrl = match[0];
        db.logActivity({
          type: 'NETWORK',
          title: 'Cloudflare Quick Tunnel Online',
          message: `Public ingress point: ${currentPublicUrl}`,
          status: 'SUCCESS'
        });
        resolve({ active: true, url: currentPublicUrl, mode: 'live' });
      }
    });

    tunnelProcess.on('close', () => {
      tunnelProcess = null;
      currentPublicUrl = null;
      tunnelType = 'OFF';
    });

    tunnelProcess.on('error', (err) => {
      tunnelProcess = null;
      currentPublicUrl = null;
      tunnelType = 'OFF';
      if (!resolved) {
        resolved = true;
        resolve({ active: false, url: null, error: err.message });
      }
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({ active: false, url: null, error: 'Tunnel initialization timed out.' });
      }
    }, 12000);
  });
}

function startTokenTunnel(token) {
  return new Promise(async (resolve) => {
    const check = await checkCloudflaredInstalled();
    if (!check.installed) {
      currentPublicUrl = `https://phonix-tunnel.yourdomain.com`;
      tunnelType = 'TOKEN_SIMULATED';
      return resolve({
        active: true,
        url: currentPublicUrl,
        mode: 'simulated'
      });
    }

    if (tunnelProcess) {
      stopTunnel();
    }

    tunnelType = 'TOKEN';
    tunnelProcess = spawn('cloudflared', ['tunnel', 'run', '--token', token.trim()]);
    currentPublicUrl = 'https://configured-in-cloudflare.com';

    db.logActivity({
      type: 'NETWORK',
      title: 'Cloudflare Named Tunnel Started',
      message: 'Running persistent tunnel service with token.',
      status: 'SUCCESS'
    });

    resolve({ active: true, url: currentPublicUrl, mode: 'live' });
  });
}

function stopTunnel() {
  if (tunnelProcess) {
    try {
      tunnelProcess.kill();
    } catch {}
    tunnelProcess = null;
  }
  currentPublicUrl = null;
  tunnelType = 'OFF';
  db.logActivity({
    type: 'NETWORK',
    title: 'Cloudflare Tunnel Stopped',
    message: 'Public ingress closed. Services are now private.',
    status: 'WARN'
  });
}

function getTunnelStatus() {
  return {
    active: Boolean(currentPublicUrl || tunnelProcess),
    url: currentPublicUrl,
    type: tunnelType
  };
}

module.exports = {
  checkCloudflaredInstalled,
  startQuickTunnel,
  startTokenTunnel,
  stopTunnel,
  getTunnelStatus
};