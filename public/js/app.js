let activeProjectIdForLogs = null;
let activeProjectIdForEnv = null;
let logsInterval = null;
let allProjectsCache = [];

// On DOM Loaded
document.addEventListener('DOMContentLoaded', () => {
  fetchTelemetry();
  fetchProjects();

  // Polling telemetry & status every 3 seconds
  setInterval(fetchTelemetry, 3000);
  setInterval(fetchProjects, 3000);

  // Setup tab switcher
  setupTabs();

  // Search filter
  document.getElementById('serviceSearchInput').addEventListener('input', (e) => {
    filterProjects(e.target.value);
  });

  // Setup modals
  document.getElementById('btnOpenNewProjectModal').addEventListener('click', () => {
    openModal('newProjectModal');
  });

  document.getElementById('newProjectForm').addEventListener('submit', handleNewProjectSubmit);
  document.getElementById('btnMasterSleep').addEventListener('click', handleMasterSleep);
  document.getElementById('tunnelPill').addEventListener('click', toggleTunnel);
});

// ----------------------------------------------------
// TAB NAVIGATION (RENDER STYLE)
// ----------------------------------------------------
function setupTabs() {
  const tabs = document.querySelectorAll('.rd-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const targetTab = tab.getAttribute('data-tab');
      document.querySelectorAll('.rd-tab-content').forEach(c => c.classList.remove('active'));
      document.getElementById(`tab-${targetTab}`).classList.add('active');
    });
  });
}

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
    document.getElementById('platformBreadcrumb').innerText = data.platform;

    // Top Navbar Telemetry
    const batt = data.battery;
    document.getElementById('batteryPercent').innerText = batt.percentage;
    document.getElementById('batteryStatus').innerText = batt.status === 'CHARGING' ? 'Charging' : 'Unplugged';
    document.getElementById('batteryTemp').innerText = batt.temperature;
    
    // RAM & CPU
    document.getElementById('memUsed').innerText = data.memory.used;
    document.getElementById('cpuLoad').innerText = (data.cpu.loadAvg[0] || 0).toFixed(2);

    // Tunnel
    const tunnel = data.tunnel;
    const tunnelPill = document.getElementById('tunnelPill');
    const tunnelText = document.getElementById('tunnelText');

    if (tunnel.active && tunnel.url) {
      tunnelPill.classList.add('active');
      tunnelText.innerHTML = `<a href="${tunnel.url}" target="_blank" style="color:inherit;text-decoration:none;">${tunnel.url.replace('https://', '')}</a>`;
    } else {
      tunnelPill.classList.remove('active');
      tunnelText.innerText = 'Local Only';
    }

    // Detailed Metrics Tab updates
    document.getElementById('metricsBattHealth').innerText = batt.health || 'Good';
    document.getElementById('metricsBattLevel').innerText = `${batt.percentage}%`;
    document.getElementById('metricsBattState').innerText = batt.status === 'CHARGING' ? '⚡ Charging' : 'Unplugged';
    document.getElementById('metricsBattProgress').style.width = `${batt.percentage}%`;
    document.getElementById('metricsBattTemp').innerText = `${batt.temperature} °C`;
    document.getElementById('metricsPowerSource').innerText = batt.plugged || 'Battery';

    document.getElementById('metricsMemPercent').innerText = `${data.memory.percentage}% Used`;
    document.getElementById('metricsMemUsed').innerText = `${data.memory.used} MB`;
    document.getElementById('metricsMemTotal').innerText = data.memory.total;
    document.getElementById('metricsMemProgress').style.width = `${data.memory.percentage}%`;
    document.getElementById('metricsMemFree').innerText = `${data.memory.free} MB`;

    document.getElementById('metricsCpuCores').innerText = `${data.cpu.cores} Cores`;
    document.getElementById('metricsCpuLoadHero').innerText = (data.cpu.loadAvg[0] || 0).toFixed(2);
    document.getElementById('metricsCpuModel').innerText = data.cpu.model;
    document.getElementById('metricsUptime').innerText = `${(data.uptime / 3600).toFixed(1)} hrs`;
  } catch (err) {
    console.error('Failed to fetch telemetry:', err);
  }
}

// ----------------------------------------------------
// PROJECTS LIST & RENDER SERVICES TABLE
// ----------------------------------------------------
async function fetchProjects() {
  try {
    const res = await fetch('/api/projects');
    const json = await res.json();
    if (!json.success) return;

    allProjectsCache = json.data;
    document.getElementById('servicesCount').innerText = allProjectsCache.length;
    renderProjects(allProjectsCache);
  } catch (err) {
    console.error('Failed to fetch projects:', err);
  }
}

function filterProjects(keyword) {
  if (!keyword || !keyword.trim()) {
    renderProjects(allProjectsCache);
    return;
  }
  const filtered = allProjectsCache.filter(p => 
    p.name.toLowerCase().includes(keyword.toLowerCase()) ||
    (p.gitUrl && p.gitUrl.toLowerCase().includes(keyword.toLowerCase()))
  );
  renderProjects(filtered);
}

function renderProjects(projects) {
  const container = document.getElementById('projectsGrid');
  if (!projects || projects.length === 0) {
    container.innerHTML = `
      <div class="rd-empty-state">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">⚡</div>
        <h3 style="font-size: 1.1rem; color: #fff; margin-bottom: 0.35rem;">No services deployed yet</h3>
        <p class="rd-text-sub">Create your first web service from a Git repository or empty template.</p>
        <button class="rd-btn rd-btn-primary" style="margin-top: 1rem;" onclick="openModal('newProjectModal')">
          + New Web Service
        </button>
      </div>
    `;
    return;
  }

  const hostname = window.location.hostname || 'localhost';

  container.innerHTML = projects.map(p => {
    let badgeHtml = '<span class="rd-badge rd-badge-sub">○ Suspended</span>';

    if (p.status === 'RUNNING') {
      badgeHtml = '<span class="rd-badge rd-badge-green"><span class="rd-status-dot rd-dot-pulse"></span>Live</span>';
    } else if (p.status === 'BUILDING') {
      badgeHtml = '<span class="rd-badge rd-badge-yellow"><span class="rd-spinner" style="width:10px;height:10px;border-width:2px;display:inline-block;margin:0;"></span>Building</span>';
    } else if (p.status === 'ERROR') {
      badgeHtml = '<span class="rd-badge rd-badge-red">● Failed</span>';
    }

    const localUrl = `http://${hostname}:${p.port}`;
    const gitBranch = p.branch || 'main';
    const commitMsg = p.commit ? p.commit.message : 'Initial release';
    const gitSource = p.gitUrl ? p.gitUrl.replace('https://github.com/', '') : 'Local Project';

    return `
      <div class="rd-service-row" id="service-${p.id}">
        <!-- Service Name & Type -->
        <div class="rd-service-info">
          <div class="rd-service-icon">🌐</div>
          <div class="rd-service-title">
            <h4>${p.name}</h4>
            <div class="rd-service-type">
              <span>Web Service</span>
              <span>•</span>
              <span>Node / ARM</span>
            </div>
          </div>
        </div>

        <!-- Git & Commit Info -->
        <div class="rd-service-git">
          <div class="rd-git-branch-pill">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="6" y1="3" x2="6" y2="15"></line>
              <circle cx="18" cy="6" r="3"></circle>
              <circle cx="6" cy="18" r="3"></circle>
              <path d="M18 9a9 9 0 0 1-9 9"></path>
            </svg>
            ${gitBranch}
          </div>
          <div class="rd-git-commit-msg" title="${commitMsg}">
            ${commitMsg}
          </div>
          <div class="rd-git-timestamp">
            ${gitSource}
          </div>
        </div>

        <!-- Port & Ingress Link -->
        <div class="rd-service-url">
          <span class="rd-service-port-label">Local Ingress</span>
          <a href="${localUrl}" target="_blank">:${p.port} ↗</a>
        </div>

        <!-- Status -->
        <div>
          ${badgeHtml}
        </div>

        <!-- Controls & Actions -->
        <div class="rd-service-actions">
          <button class="rd-btn rd-btn-secondary rd-btn-sm" onclick="openLogsModal('${p.id}', '${p.name}')" title="Live Deploy & Runtime Logs">
            Logs
          </button>
          <button class="rd-btn rd-btn-secondary rd-btn-sm" onclick="openEnvModal('${p.id}', '${p.name}')" title="Configure .env Environment Variables">
            Env
          </button>
          <button class="rd-btn rd-btn-ghost rd-btn-sm" onclick="redeployProject('${p.id}')" title="Pull latest Git commit & restart">
            🔄
          </button>
          <button class="rd-btn rd-btn-ghost rd-btn-sm" onclick="deleteProject('${p.id}', '${p.name}')" title="Delete Service">
            🗑️
          </button>

          <!-- Render Power Toggle -->
          <label class="rd-toggle" title="Scale to zero (turn OFF) to save battery">
            <input type="checkbox" ${p.isRunning ? 'checked' : ''} onchange="toggleProjectPower('${p.id}', this.checked)">
            <span class="rd-toggle-slider"></span>
          </label>
        </div>
      </div>
    `;
  }).join('');
}

// ----------------------------------------------------
// ACTIONS
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
    alert(`Failed to toggle service: ${err.message}`);
    await fetchProjects();
  }
}

async function redeployProject(projectId) {
  if (!confirm('Pull latest Git commit and rebuild service?')) return;
  try {
    const res = await fetch(`/api/projects/${projectId}/redeploy`, { method: 'POST' });
    const json = await res.json();
    if (!json.success) {
      alert(`Deploy failed: ${json.error}`);
    } else {
      openLogsModal(projectId, projectId);
    }
    await fetchProjects();
  } catch (err) {
    alert(`Deploy failed: ${err.message}`);
  }
}

async function deleteProject(projectId, name) {
  if (!confirm(`Are you sure you want to permanently delete service "${name}" and all local files?`)) return;
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
  if (!confirm('Put ALL running services into deep sleep? This drops CPU to 0% and saves battery health.')) return;
  try {
    const res = await fetch('/api/actions/sleep-all', { method: 'POST' });
    const json = await res.json();
    alert(json.message);
    await fetchProjects();
    await fetchTelemetry();
  } catch (err) {
    alert(`Sleep all failed: ${err.message}`);
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
      alert(`Tunnel status: ${json.data.error}`);
    }
    await fetchTelemetry();
  } catch (err) {
    alert(`Tunnel action failed: ${err.message}`);
  }
}

// ----------------------------------------------------
// CREATE WEB SERVICE FORM
// ----------------------------------------------------
async function handleNewProjectSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('btnSubmitProject');
  const originalText = btn.innerText;

  btn.disabled = true;
  btn.innerText = 'Provisioning Service...';

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
      alert(`Failed to create service: ${json.error}`);
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
// RENDER-STYLE LOGS VIEWER
// ----------------------------------------------------
function openLogsModal(projectId, projectName) {
  activeProjectIdForLogs = projectId;
  document.getElementById('logsModalTitle').innerText = `${projectName} — Logs`;
  document.getElementById('terminalOutput').innerText = 'Streaming logs from process stdout/stderr...';
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
      output.innerText = json.data.length > 0 ? json.data.join('\n') : 'No output recorded yet. Toggle service Live to view stream.';
      output.scrollTop = output.scrollHeight;
    }
  } catch (err) {
    console.error('Error fetching logs:', err);
  }
}

// ----------------------------------------------------
// ENVIRONMENT VARIABLES MODAL
// ----------------------------------------------------
async function openEnvModal(projectId, projectName) {
  activeProjectIdForEnv = projectId;
  document.getElementById('envModalTitle').innerText = `${projectName} — Environment`;
  const container = document.getElementById('envRowsContainer');
  container.innerHTML = '<p class="rd-text-sub">Loading secrets...</p>';

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
  div.className = 'rd-env-row';
  div.innerHTML = `
    <input type="text" placeholder="KEY" value="${key}" class="env-key">
    <input type="text" placeholder="VALUE" value="${val}" class="env-val">
    <button type="button" class="rd-btn rd-btn-danger rd-btn-sm" onclick="this.parentElement.remove()">✕</button>
  `;
  container.appendChild(div);
}

async function saveCurrentEnv() {
  if (!activeProjectIdForEnv) return;
  const rows = document.querySelectorAll('#envRowsContainer .rd-env-row');
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
      alert('Environment variables saved! They will take effect on next start or deploy.');
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
