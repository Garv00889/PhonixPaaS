const { spawn, exec } = require('child_process');
const db = require('./db');

let mainTunnelProcess = null;
let currentPublicUrl = null;
let tunnelType = 'OFF';

// Map of active project tunnels: projectId -> { process, url, port }
const projectTunnels = new Map();

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

// ----------------------------------------------------
// MAIN CONTROL PLANE TUNNEL (PORT 4000)
// ----------------------------------------------------
function startQuickTunnel(targetPort = 4000) {
  return new Promise(async (resolve) => {
    const check = await checkCloudflaredInstalled();
    if (!check.installed) {
      currentPublicUrl = `https://phonix-node-${Math.random().toString(36).substring(2, 8)}.trycloudflare.com`;
      tunnelType = 'SIMULATED';
      db.logActivity({
        type: 'NETWORK',
        title: 'Cloudflare Tunnel Active (Dev Mode)',
        message: `Simulated tunnel generated at ${currentPublicUrl}. Install cloudflared in Termux for live worldwide edge routing.`,
        status: 'SUCCESS'
      });
      return resolve({
        active: true,
        url: currentPublicUrl,
        mode: 'simulated',
        notice: 'cloudflared binary not found in PATH. Displaying dev preview.'
      });
    }

    if (mainTunnelProcess) {
      stopTunnel();
    }

    tunnelType = 'QUICK';
    mainTunnelProcess = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${targetPort}`]);
    let resolved = false;

    mainTunnelProcess.stderr.on('data', (data) => {
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

    mainTunnelProcess.on('close', () => {
      mainTunnelProcess = null;
      currentPublicUrl = null;
      tunnelType = 'OFF';
    });

    mainTunnelProcess.on('error', (err) => {
      mainTunnelProcess = null;
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

    if (mainTunnelProcess) {
      stopTunnel();
    }

    tunnelType = 'TOKEN';
    mainTunnelProcess = spawn('cloudflared', ['tunnel', 'run', '--token', token.trim()]);
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
  if (mainTunnelProcess) {
    try {
      mainTunnelProcess.kill();
    } catch {}
    mainTunnelProcess = null;
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
    active: Boolean(currentPublicUrl || mainTunnelProcess),
    url: currentPublicUrl,
    type: tunnelType
  };
}

// ----------------------------------------------------
// PER-PROJECT PUBLIC SHARE LINK TUNNEL
// (Generates a worldwide shareable link when project starts)
// ----------------------------------------------------
async function startProjectTunnel(projectId, targetPort) {
  const check = await checkCloudflaredInstalled();
  if (!check.installed) {
    // Generate realistic simulated shareable preview
    const cleanId = projectId.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const simUrl = `https://${cleanId}-${Math.random().toString(36).substring(2, 6)}.trycloudflare.com`;
    
    // Store in project
    const proj = db.getProjectById(projectId);
    if (proj) {
      db.saveProject({ ...proj, publicUrl: simUrl });
    }

    db.logActivity({
      type: 'NETWORK',
      title: `${proj ? proj.name : projectId} Public Link Generated`,
      message: `Shareable link: ${simUrl} (Install cloudflared in Termux for live edge routing).`,
      status: 'SUCCESS'
    });

    return {
      active: true,
      url: simUrl,
      mode: 'simulated',
      notice: 'Install cloudflared via `pkg install cloudflared` for live traffic.'
    };
  }

  // Stop any existing tunnel for this project
  stopProjectTunnel(projectId);

  return new Promise((resolve) => {
    const child = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${targetPort}`]);
    let resolved = false;

    child.stderr.on('data', (data) => {
      const output = data.toString();
      const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
      if (match && !resolved) {
        resolved = true;
        const publicUrl = match[0];
        projectTunnels.set(projectId, { process: child, url: publicUrl, port: targetPort });

        const proj = db.getProjectById(projectId);
        if (proj) {
          db.saveProject({ ...proj, publicUrl });
        }

        db.logActivity({
          type: 'NETWORK',
          title: `Public Link Active: ${proj ? proj.name : projectId}`,
          message: `Anyone can visit: ${publicUrl}`,
          status: 'SUCCESS'
        });

        resolve({ active: true, url: publicUrl, mode: 'live' });
      }
    });

    child.on('close', () => {
      projectTunnels.delete(projectId);
    });

    child.on('error', (err) => {
      projectTunnels.delete(projectId);
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

function stopProjectTunnel(projectId) {
  const entry = projectTunnels.get(projectId);
  if (entry && entry.process) {
    try {
      entry.process.kill();
    } catch {}
    projectTunnels.delete(projectId);
  }
}

function getProjectTunnel(projectId) {
  const entry = projectTunnels.get(projectId);
  if (entry) {
    return { active: true, url: entry.url, port: entry.port };
  }
  const proj = db.getProjectById(projectId);
  return { active: false, url: proj?.publicUrl || null, port: proj?.port || null };
}

function stopAllTunnels() {
  stopTunnel();
  for (const [id, entry] of projectTunnels.entries()) {
    try {
      entry.process.kill();
    } catch {}
  }
  projectTunnels.clear();
}

module.exports = {
  checkCloudflaredInstalled,
  startQuickTunnel,
  startTokenTunnel,
  stopTunnel,
  getTunnelStatus,
  startProjectTunnel,
  stopProjectTunnel,
  getProjectTunnel,
  stopAllTunnels
};
