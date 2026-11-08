let activeProjectIdForLogs = null;
let activeProjectIdForEnv = null;
let logsInterval = null;

// On DOM Loaded
document.addEventListener('DOMContentLoaded', () => {
  fetchTelemetry();
  fetchProjects();

  // Polling telemetry & status every 3 seconds
  setInterval(fetchTelemetry, 3000);
  setInterval(fetchProjects, 3000);

  // Setup modal triggers
  document.getElementById('btnOpenNewProjectModal').addEventListener('click', () => {
    openModal('newProjectModal');
  });

  document.getElementById('newProjectForm').addEventListener('submit', handleNewProjectSubmit);
  document.getElementById('sidebarSleepBtn').addEventListener('click', handleMasterSleep);
});

// ----------------------------------------------------
// TELEMETRY UPDATE
// ----------------------------------------------------
async function fetchTelemetry() {
  try {
    const res = await fetch('/api/telemetry');
    const json = await res.json();
    if (!json.success) return;

    const data = json.data;
    const batt = data.battery;

    // Topbar Pill
    document.getElementById('topbarBattery').innerText = `${batt.percentage}%`;
    document.getElementById('topbarTemp').innerText = `${batt.temperature}°C`;

    // Telemetry Dot color
    const dot = document.getElementById('telemetryDot');
    if (batt.temperature > 40) {
      dot.style.background = '#f59e0b';
      dot.style.boxShadow = '0 0 6px #f59e0b';
    } else {
      dot.style.background = '#30a46c';
      dot.style.boxShadow = '0 0 6px #30a46c';
    }
  } catch (err) {
    console.error('Failed to fetch telemetry:', err);
  }
}

// ----------------------------------------------------
// PROJECTS LIST & RENDER CARDS (MATCHING SCREENSHOT)
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
  const container = document.getElementById('projectsGrid');
  const hostname = window.location.hostname || 'localhost';

  // 1. Render all active project cards
  let cardsHtml = (projects || []).map(p => {
    let statusText = '✓ All services are up and running';
    let statusClass = 'rd-status-banner';

    if (p.status === 'STOPPED') {
      statusText = '⏸ Service is in standby';
      statusClass = 'rd-status-banner standby';
    } else if (p.status === 'BUILDING') {
      statusText = '⚙ Building deployment...';
      statusClass = 'rd-status-banner';
    } else if (p.status === 'ERROR') {
      statusText = '✕ Service encountered an error';
      statusClass = 'rd-status-banner error';
    }

    const localUrl = `http://${hostname}:${p.port}`;
    const gitSource = p.gitUrl ? p.gitUrl.replace('https://github.com/', '') : 'Local Project';

    return `
      <div class="rd-project-card" id="project-${p.id}">
        <div>
          <div class="rd-card-header-row">
            <h3 class="rd-card-project-name">${p.name}</h3>
            <button class="rd-card-menu-btn" onclick="openLogsModal('${p.id}', '${p.name}')" title="View Logs">···</button>
          </div>
          <div style="font-size: 11px; color: #5f6876; margin-top: 4px; font-family: monospace;">
            ${gitSource}
          </div>
        </div>

        <div>
          <!-- Render green status badge matching screenshot -->
          <div class="${statusClass}">
            ${statusText}
          </div>

          <!-- Bottom details & controls -->
          <div class="rd-card-footer-row">
            <a href="${localUrl}" target="_blank" class="rd-card-port-link">:${p.port} ↗</a>
            <div class="rd-card-actions-mini">
              <button class="rd-mini-btn" onclick="openLogsModal('${p.id}', '${p.name}')">Logs</button>
              <button class="rd-mini-btn" onclick="openEnvModal('${p.id}', '${p.name}')">Env</button>
              <button class="rd-mini-btn" onclick="redeployProject('${p.id}')">Deploy</button>
              <button class="rd-mini-btn" style="color: #ef4444;" onclick="deleteProject('${p.id}', '${p.name}')">✕</button>
              <button class="rd-mini-btn" style="${p.isRunning ? 'color:#10b981;' : 'color:#94a3b8;'}" onclick="toggleProjectPower('${p.id}', ${!p.isRunning})">
                ${p.isRunning ? '🟢 Active' : '⏸ Sleep'}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // 2. Append the "+ Create new project" dashed card (matching the screenshot exactly)
  cardsHtml += `
    <div class="rd-create-project-card" onclick="openModal('newProjectModal')">
      <span>+ Create new project</span>
    </div>
  `;

  container.innerHTML = cardsHtml;
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
  if (!confirm('Rebuild and deploy latest changes?')) return;
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
  if (!confirm(`Are you sure you want to permanently delete "${name}"?`)) return;
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
  if (!confirm('Put ALL running services into deep sleep to protect battery health?')) return;
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

// ----------------------------------------------------
// NEW PROJECT SUBMISSION
// ----------------------------------------------------
async function handleNewProjectSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('btnSubmitProject');
  const originalText = btn.innerText;

  btn.disabled = true;
  btn.innerText = 'Creating Project...';

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
  document.getElementById('logsModalTitle').innerText = `${projectName} — Logs`;
  document.getElementById('terminalOutput').innerText = 'Streaming logs from process...';
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
      output.innerText = json.data.length > 0 ? json.data.join('\n') : 'No output recorded yet. Toggle service on to view logs.';
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
  container.innerHTML = '<p style="color:#5f6876; font-size:12px;">Loading variables...</p>';

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
  div.style.display = 'grid';
  div.style.gridTemplateColumns = '1fr 1fr 32px';
  div.style.gap = '8px';
  div.style.marginBottom = '8px';
  div.innerHTML = `
    <input type="text" placeholder="KEY" value="${key}" class="env-key">
    <input type="text" placeholder="VALUE" value="${val}" class="env-val">
    <button type="button" class="rd-mini-btn" style="color:#ef4444;" onclick="this.parentElement.remove()">✕</button>
  `;
  container.appendChild(div);
}

async function saveCurrentEnv() {
  if (!activeProjectIdForEnv) return;
  const rows = document.querySelectorAll('#envRowsContainer > div');
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
      alert('Environment variables saved!');
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
