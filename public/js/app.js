let activeProjectIdForLogs = null;
let activeProjectIdForEnv = null;
let logsInterval = null;

// On DOM Loaded
document.addEventListener('DOMContentLoaded', () => {
  fetchTelemetry();
  fetchProjects();

  // Polling telemetry every 3 seconds
  setInterval(fetchTelemetry, 3000);

  // Setup event listeners
  document.getElementById('btnOpenNewProjectModal').addEventListener('click', () => {
    openModal('newProjectModal');
  });

  document.getElementById('newProjectForm').addEventListener('submit', handleNewProjectSubmit);
  document.getElementById('btnMasterSleep').addEventListener('click', handleMasterSleep);
  document.getElementById('tunnelPill').addEventListener('click', toggleTunnel);
});

// ----------------------------------------------------
// TELEMETRY
// ----------------------------------------------------
async function fetchTelemetry() {
  try {
    const res = await fetch('/api/telemetry');
    const json = await res.json();
    if (!json.success) return;

    const data = json.data;

    // Platform badge
    document.getElementById('platformBadge').innerText = data.platform;

    // Battery
    const batt = data.battery;
    document.getElementById('batteryPercent').innerText = batt.percentage;
    document.getElementById('batteryStatus').innerText = batt.status === 'CHARGING' ? '⚡ Charging' : 'Unplugged';
    document.getElementById('batteryTemp').innerText = batt.temperature;
    document.getElementById('batteryIcon').innerText = batt.status === 'CHARGING' ? '🔋' : '🪫';

    // RAM
    document.getElementById('memUsed').innerText = data.memory.used;
    document.getElementById('memTotal').innerText = data.memory.total;
    document.getElementById('memPercent').innerText = data.memory.percentage;

    // CPU
    document.getElementById('cpuCores').innerText = data.cpu.cores;
    document.getElementById('cpuLoad').innerText = (data.cpu.loadAvg[0] || 0).toFixed(2);

    // Tunnel
    const tunnel = data.tunnel;
    const tunnelPill = document.getElementById('tunnelPill');
    const tunnelText = document.getElementById('tunnelText');

    if (tunnel.active && tunnel.url) {
      tunnelPill.classList.add('active');
      tunnelText.innerHTML = `<a href="${tunnel.url}" target="_blank" style="color:inherit;text-decoration:none;">Live: ${tunnel.url.replace('https://', '')}</a>`;
    } else {
      tunnelPill.classList.remove('active');
      tunnelText.innerText = 'Local Only (Click to Tunnel)';
    }
  } catch (err) {
    console.error('Failed to fetch telemetry:', err);
  }
}

// ----------------------------------------------------
// PROJECTS
// ----------------------------------------------------
async function fetchProjects() {
  try {
    const res = await fetch('/api/projects');
    const json = await res.json();
    if (!json.success) return;

    renderProjects(json.data);
  } catch (err) {
    console.error('Failed to fetch projects:', err);
  }
}

function renderProjects(projects) {
  const grid = document.getElementById('projectsGrid');
  if (!projects || projects.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📱✨</div>
        <h3 style="font-size: 1.2rem; color: #fff; margin-bottom: 0.5rem;">No Projects Hosted Yet</h3>
        <p>Deploy your first portfolio, API, or website directly onto this device.</p>
        <button class="btn btn-primary" style="margin-top: 1rem;" onclick="openModal('newProjectModal')">
          + Deploy First Project
        </button>
      </div>
    `;
    return;
  }

  const hostname = window.location.hostname || 'localhost';

  grid.innerHTML = projects.map(p => {
    let badgeClass = 'badge-standby';
    let badgeText = 'Standby';

    if (p.status === 'RUNNING') {
      badgeClass = 'badge-live';
      badgeText = 'Live';
    } else if (p.status === 'BUILDING') {
      badgeClass = 'badge-building';
      badgeText = 'Building...';
    } else if (p.status === 'ERROR') {
      badgeClass = 'badge-error';
      badgeText = 'Failed';
    }

    const localUrl = `http://${hostname}:${p.port}`;
    const gitSource = p.gitUrl ? p.gitUrl.replace('https://github.com/', '') : 'Local Starter';
    const commitMsg = p.commit ? p.commit.message : 'Clean template';

    return `
      <div class="project-card" id="card-${p.id}">
        <div class="card-top">
          <div class="card-title">
            <h3>${p.name}</h3>
            <div class="card-git">
              <span>📦 ${gitSource}</span>
            </div>
          </div>
          <span class="badge ${badgeClass}">${badgeText}</span>
        </div>

        <div class="card-details">
          <div class="detail-row">
            <span class="label">Local Port</span>
            <span class="value"><a href="${localUrl}" target="_blank">:${p.port} ↗</a></span>
          </div>
          <div class="detail-row">
            <span class="label">Last Commit</span>
            <span class="value" title="${commitMsg}">${commitMsg.length > 25 ? commitMsg.substring(0, 22) + '...' : commitMsg}</span>
          </div>
          <div class="detail-row">
            <span class="label">Start Command</span>
            <span class="value">${p.startCmd}</span>
          </div>
        </div>

        <div class="card-actions">
          <div class="action-buttons">
            <button class="btn btn-sm btn-secondary" onclick="openLogsModal('${p.id}', '${p.name}')" title="View Console Logs">
              📋 Logs
            </button>
            <button class="btn btn-sm btn-secondary" onclick="openEnvModal('${p.id}', '${p.name}')" title="Configure Environment">
              ⚙️ .env
            </button>
            <button class="btn btn-sm btn-secondary" onclick="redeployProject('${p.id}')" title="Pull latest code and restart">
              🔄 Deploy
            </button>
            <button class="btn btn-sm btn-danger" onclick="deleteProject('${p.id}', '${p.name}')" title="Delete Project">
              🗑️
            </button>
          </div>

          <!-- Power Toggle -->
          <label class="toggle-switch" title="Toggle project ON (Live) or OFF (Standby to save battery)">
            <input type="checkbox" ${p.isRunning ? 'checked' : ''} onchange="toggleProjectPower('${p.id}', this.checked)">
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
    `;
  }).join('');
}

// ----------------------------------------------------
// PROJECT ACTIONS
// ----------------------------------------------------
async function toggleProjectPower(projectId, shouldStart) {
  const endpoint = shouldStart ? `/api/projects/${projectId}/start` : `/api/projects/${projectId}/stop`;
  try {
    const res = await fetch(endpoint, { method: 'POST' });
    const json = await res.json();
    if (!json.success) {
      alert(`Error: ${json.error}`);
    }
    await fetchProjects();
    await fetchTelemetry();
  } catch (err) {
    alert(`Failed to toggle project: ${err.message}`);
    await fetchProjects();
  }
}

async function redeployProject(projectId) {
  if (!confirm('Re-pull latest code from Git and rebuild?')) return;
  try {
    const res = await fetch(`/api/projects/${projectId}/redeploy`, { method: 'POST' });
    const json = await res.json();
    if (!json.success) {
      alert(`Redeploy failed: ${json.error}`);
    } else {
      openLogsModal(projectId, projectId);
    }
    await fetchProjects();
  } catch (err) {
    alert(`Redeploy failed: ${err.message}`);
  }
}

async function deleteProject(projectId, name) {
  if (!confirm(`Are you sure you want to completely delete "${name}" and all its local files?`)) return;
  try {
    const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
    const json = await res.json();
    if (!json.success) {
      alert(`Delete failed: ${json.error}`);
    }
    await fetchProjects();
  } catch (err) {
    alert(`Delete failed: ${err.message}`);
  }
}

async function handleMasterSleep() {
  if (!confirm('Put ALL running projects into deep sleep? This frees RAM and lets the phone rest.')) return;
  try {
    const res = await fetch('/api/actions/sleep-all', { method: 'POST' });
    const json = await res.json();
    alert(json.message);
    await fetchProjects();
    await fetchTelemetry();
  } catch (err) {
    alert(`Master sleep failed: ${err.message}`);
  }
}

async function toggleTunnel() {
  const tunnelPill = document.getElementById('tunnelPill');
  const isActive = tunnelPill.classList.contains('active');

  const endpoint = isActive ? '/api/tunnel/stop' : '/api/tunnel/start';
  try {
    const res = await fetch(endpoint, { method: 'POST' });
    const json = await res.json();
    if (json.data && json.data.error) {
      alert(`Cloudflare Tunnel notice: ${json.data.error}`);
    }
    await fetchTelemetry();
  } catch (err) {
    alert(`Tunnel action failed: ${err.message}`);
  }
}

// ----------------------------------------------------
// NEW PROJECT FORM
// ----------------------------------------------------
async function handleNewProjectSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('btnSubmitProject');
  const originalText = btn.innerText;

  btn.disabled = true;
  btn.innerText = 'Cloning & Setting Up...';

  const name = document.getElementById('projectName').value.trim();
  const gitUrl = document.getElementById('gitUrl').value.trim();
  const branch = document.getElementById('gitBranch').value.trim();
  const port = document.getElementById('projectPort').value.trim();
  const buildCmd = document.getElementById('buildCmd').value.trim();
  const startCmd = document.getElementById('startCmd').value.trim();

  try {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, gitUrl, branch, port, buildCmd, startCmd })
    });

    const json = await res.json();
    if (!json.success) {
      alert(`Failed to create project: ${json.error}`);
    } else {
      closeModal('newProjectModal');
      document.getElementById('newProjectForm').reset();
      await fetchProjects();
    }
  } catch (err) {
    alert(`Submission error: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.innerText = originalText;
  }
}

// ----------------------------------------------------
// LOGS MODAL
// ----------------------------------------------------
function openLogsModal(projectId, projectName) {
  activeProjectIdForLogs = projectId;
  document.getElementById('logsModalTitle').innerText = `Logs: ${projectName}`;
  document.getElementById('terminalOutput').innerText = 'Loading logs...';
  openModal('logsModal');

  refreshCurrentLogs();

  if (logsInterval) clearInterval(logsInterval);
  logsInterval = setInterval(refreshCurrentLogs, 2000);
}

async function refreshCurrentLogs() {
  if (!activeProjectIdForLogs) return;
  try {
    const res = await fetch(`/api/projects/${activeProjectIdForLogs}/logs`);
    const json = await res.json();
    if (json.success) {
      const output = document.getElementById('terminalOutput');
      output.innerText = json.data.length > 0 ? json.data.join('\n') : 'No output yet. Start the project to see logs.';
      output.scrollTop = output.scrollHeight;
    }
  } catch (err) {
    console.error('Error fetching logs:', err);
  }
}

// ----------------------------------------------------
// ENV VARIABLES MODAL
// ----------------------------------------------------
async function openEnvModal(projectId, projectName) {
  activeProjectIdForEnv = projectId;
  document.getElementById('envModalTitle').innerText = `Environment: ${projectName}`;
  const container = document.getElementById('envRowsContainer');
  container.innerHTML = 'Loading variables...';

  openModal('envModal');

  try {
    const res = await fetch('/api/projects');
    const json = await res.json();
    const project = json.data.find(p => p.id === projectId);
    container.innerHTML = '';

    const env = project.env || {};
    const keys = Object.keys(env);

    if (keys.length === 0) {
      addEnvRow('', '');
    } else {
      keys.forEach(k => addEnvRow(k, env[k]));
    }
  } catch (err) {
    container.innerHTML = 'Failed to load variables.';
  }
}

function addEnvRow(key = '', val = '') {
  const container = document.getElementById('envRowsContainer');
  const div = document.createElement('div');
  div.className = 'env-row';
  div.innerHTML = `
    <input type="text" placeholder="KEY (e.g. API_KEY)" value="${key}" class="env-key">
    <input type="text" placeholder="VALUE" value="${val}" class="env-val">
    <button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">✕</button>
  `;
  container.appendChild(div);
}

async function saveCurrentEnv() {
  if (!activeProjectIdForEnv) return;
  const rows = document.querySelectorAll('#envRowsContainer .env-row');
  const env = {};

  rows.forEach(r => {
    const k = r.querySelector('.env-key').value.trim();
    const v = r.querySelector('.env-val').value.trim();
    if (k) env[k] = v;
  });

  try {
    const res = await fetch(`/api/projects/${activeProjectIdForEnv}/env`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ env })
    });
    const json = await res.json();
    if (json.success) {
      closeModal('envModal');
      alert('Environment variables updated! They will take effect on next start/restart.');
    } else {
      alert(`Failed to save env: ${json.error}`);
    }
  } catch (err) {
    alert(`Save error: ${err.message}`);
  }
}

// ----------------------------------------------------
// MODAL HELPERS
// ----------------------------------------------------
function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  if (id === 'logsModal' && logsInterval) {
    clearInterval(logsInterval);
    logsInterval = null;
    activeProjectIdForLogs = null;
  }
  if (id === 'envModal') {
    activeProjectIdForEnv = null;
  }
}
