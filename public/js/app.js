// ==============================================================================
// PHONIXPAAS FRONTEND CONTROLLER (Render-Style PaaS Engine)
// Full SPA Navigation, Real-Time Hardware Telemetry, Process & Ingress Lifecycle
// ==============================================================================

let currentView = 'dashboard';
let allProjectsData = [];
let currentFilter = 'all';
let activeProjectIdForLogs = null;
let activeProjectIdForEnv = null;
let logsInterval = null;
let tunnelMode = 'quick';

// Section & Title Map for Dynamic Breadcrumbs
const BREADCRUMB_MAP = {
  dashboard: { section: 'Overview', page: 'Dashboard & Health' },
  projects: { section: 'Overview', page: 'Projects & Services' },
  deployments: { section: 'Deployments', page: 'Releases & Audit Log' },
  networking: { section: 'Networking', page: 'Tunnels, Domains & Ports' },
  monitoring: { section: 'Monitoring', page: 'Hardware, Battery & Logs' },
  devtools: { section: 'Developer Tools', page: 'Console, Webhooks & Env' },
  infrastructure: { section: 'Infrastructure', page: 'Node Specs & Power' },
  integrations: { section: 'Integrations', page: 'Cloudflare, Git & DBs' },
  settings: { section: 'Settings', page: 'Platform Settings & Recovery' }
};

// ----------------------------------------------------
// INITIALIZATION
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initRouting();
  initEventListeners();

  // Initial Data Fetch
  fetchAllCoreData();

  // Polling every 3.5 seconds
  setInterval(() => {
    fetchTelemetry();
    if (currentView === 'projects' || currentView === 'dashboard') {
      fetchProjects(false);
    }
  }, 3500);
});

function initEventListeners() {
  // Modal triggers
  const btnNew = document.getElementById('btnOpenNewProjectModal');
  if (btnNew) btnNew.addEventListener('click', () => openModal('newProjectModal'));

  const formNew = document.getElementById('newProjectForm');
  if (formNew) formNew.addEventListener('submit', handleNewProjectSubmit);

  const sidebarSleep = document.getElementById('sidebarSleepBtn');
  if (sidebarSleep) sidebarSleep.addEventListener('click', handleMasterSleep);

  // Search input live filtering
  const searchInput = document.getElementById('projectSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      if (currentView !== 'projects') switchView('projects');
      renderProjects(allProjectsData);
    });
  }

  // Project filter tabs
  const tabPills = document.querySelectorAll('#projectFilterTabs .rd-tab-pill');
  tabPills.forEach(pill => {
    pill.addEventListener('click', () => {
      tabPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentFilter = pill.getAttribute('data-filter') || 'all';
      renderProjects(allProjectsData);
    });
  });

  // Developer terminal form
  const termForm = document.getElementById('devTerminalForm');
  if (termForm) {
    termForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('devTerminalInput');
      const cmd = input.value.trim();
      if (cmd) {
        executeTerminalCommand(cmd);
        input.value = '';
      }
    });
  }

  // Mobile menu toggle
  const mobileBtn = document.getElementById('mobileMenuBtn');
  const sidebar = document.getElementById('appSidebar');
  if (mobileBtn && sidebar) {
    mobileBtn.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
    });
  }
}

// ----------------------------------------------------
// SPA ROUTING & NAVIGATION
// ----------------------------------------------------
function initRouting() {
  // Listen for hash changes
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    switchView(hash, false);
  });

  // Bind click events on all sidebar links
  const navLinks = document.querySelectorAll('.rd-sidebar-nav [data-view]');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const view = link.getAttribute('data-view');
      switchView(view);
      // Close mobile menu if open
      const sidebar = document.getElementById('appSidebar');
      if (sidebar) sidebar.classList.remove('mobile-open');
    });
  });

  // Initial view from URL hash
  const initialHash = window.location.hash.replace('#', '') || 'dashboard';
  switchView(initialHash, false);
}

function switchView(viewName, updateHash = true) {
  if (!BREADCRUMB_MAP[viewName]) viewName = 'dashboard';
  currentView = viewName;

  if (updateHash) {
    window.location.hash = viewName;
  }

  // Update Breadcrumbs
  const info = BREADCRUMB_MAP[viewName];
  const bSection = document.getElementById('breadcrumbSection');
  const bPage = document.getElementById('breadcrumbPage');
  if (bSection) bSection.innerText = info.section;
  if (bPage) bPage.innerText = info.page;

  // Update Sidebar active item
  document.querySelectorAll('.rd-sidebar-nav .rd-nav-item').forEach(el => {
    if (el.getAttribute('data-view') === viewName) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });

  // Switch View Container
  document.querySelectorAll('.rd-view').forEach(view => {
    view.classList.remove('active');
  });
  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) {
    targetView.classList.add('active');
  }

  // View-specific data fetching
  if (viewName === 'dashboard') {
    fetchTelemetry();
    fetchActivity();
    fetchProjects(false);
  } else if (viewName === 'projects') {
    fetchProjects();
  } else if (viewName === 'deployments') {
    fetchDeployments();
  } else if (viewName === 'networking') {
    fetchNetworking();
  } else if (viewName === 'monitoring') {
    fetchTelemetry();
    fetchProcesses();
  } else if (viewName === 'devtools') {
    fetchWebhooks();
  } else if (viewName === 'infrastructure') {
    fetchHardwareDiagnostics();
  } else if (viewName === 'settings') {
    fetchSettings();
  }
}

// ----------------------------------------------------
// THEME SWITCHER
// ----------------------------------------------------
function initTheme() {
  const savedTheme = localStorage.getItem('phonix_theme') || 'light';
  applyTheme(savedTheme);

  const toggleBtn = document.getElementById('themeToggleBtn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const isDark = document.body.getAttribute('data-theme') === 'dark';
      const nextTheme = isDark ? 'light' : 'dark';
      applyTheme(nextTheme);
      localStorage.setItem('phonix_theme', nextTheme);
    });
  }
}

function applyTheme(theme) {
  const icon = document.getElementById('themeToggleIcon');
  const text = document.getElementById('themeToggleText');
  const globalBg = document.getElementById('globalBgShaderIframe');
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.body.setAttribute('data-theme', 'dark');
    if (icon) icon.innerText = '🌙';
    if (text) text.innerText = 'Dark';
    if (globalBg) globalBg.src = '/scene/?mode=dark&speed=0.20';
  } else {
    document.documentElement.removeAttribute('data-theme');
    document.body.removeAttribute('data-theme');
    if (icon) icon.innerText = '☀️';
    if (text) text.innerText = 'Light';
    if (globalBg) globalBg.src = '/scene/?mode=light&speed=0.20';
  }
}

// ----------------------------------------------------
// DATA FETCHING & SYNCHRONIZATION
// ----------------------------------------------------
async function fetchAllCoreData() {
  await Promise.all([
    fetchTelemetry(),
    fetchProjects(false),
    fetchActivity(),
    fetchNetworking()
  ]);
}

// 1. Telemetry & Hardware Stats
async function fetchTelemetry() {
  try {
    const res = await fetch('/api/telemetry');
    const json = await res.json();
    if (!json.success) return;

    const data = json.data;
    const batt = data.battery;
    const mem = data.memory;
    const storage = data.storage || { percentage: 35, freeGB: 40, totalGB: 64 };

    // Workspace Title & Avatar
    if (data.workspaceName) {
      const titleEl = document.getElementById('workspaceTitle');
      const avatarEl = document.getElementById('workspaceAvatar');
      if (titleEl) titleEl.innerText = data.workspaceName;
      if (avatarEl) avatarEl.innerText = data.workspaceName.charAt(0).toUpperCase();
    }

    // Topbar Pill
    const topbarBatt = document.getElementById('topbarBattery');
    const topbarTemp = document.getElementById('topbarTemp');
    if (topbarBatt) topbarBatt.innerText = `${batt.percentage}%`;
    if (topbarTemp) topbarTemp.innerText = `${batt.temperature}°C`;

    const dot = document.getElementById('telemetryDot');
    if (dot) {
      dot.style.background = batt.temperature > 42 ? '#ef4444' : (batt.temperature > 38 ? '#f59e0b' : '#30a46c');
    }

    // Dashboard 4 Metric Cards
    const statBattVal = document.getElementById('statBatteryVal');
    const statBattSub = document.getElementById('statBatterySub');
    const statBattBar = document.getElementById('statBatteryBar');
    const statBattBadge = document.getElementById('statBatteryStatusBadge');
    if (statBattVal) statBattVal.innerText = `${batt.percentage}%`;
    if (statBattSub) statBattSub.innerText = `Temp: ${batt.temperature}°C · Cell: ${batt.voltage || '4.1V'}`;
    if (statBattBar) statBattBar.style.width = `${batt.percentage}%`;
    if (statBattBadge) statBattBadge.innerText = batt.status;

    // RAM Card
    const statRamVal = document.getElementById('statRamVal');
    const statRamSub = document.getElementById('statRamSub');
    const statRamBar = document.getElementById('statRamBar');
    const statRamPercent = document.getElementById('statRamPercent');
    if (statRamVal) statRamVal.innerText = `${mem.used} MB`;
    if (statRamSub) statRamSub.innerText = `Free: ${mem.free} MB of ${mem.total} MB`;
    if (statRamBar) statRamBar.style.width = `${mem.percentage}%`;
    if (statRamPercent) statRamPercent.innerText = `${mem.percentage}%`;

    // Storage Card
    const statStoreVal = document.getElementById('statStorageVal');
    const statStoreSub = document.getElementById('statStorageSub');
    const statStoreBar = document.getElementById('statStorageBar');
    const statStorePercent = document.getElementById('statStoragePercent');
    if (statStoreVal) statStoreVal.innerText = `${storage.freeGB} GB`;
    if (statStoreSub) statStoreSub.innerText = `Free of ${storage.totalGB} GB on flash`;
    if (statStoreBar) statStoreBar.style.width = `${storage.percentage}%`;
    if (statStorePercent) statStorePercent.innerText = `${storage.percentage}% used`;

    // Tunnel Ingress status in Dashboard
    const tunnel = data.tunnel;
    const dashTunnelUrl = document.getElementById('dashTunnelUrl');
    const dashTunnelBtn = document.getElementById('dashTunnelToggleBtn');
    if (dashTunnelUrl) {
      if (tunnel.active && tunnel.url) {
        dashTunnelUrl.innerHTML = `<a href="${tunnel.url}" target="_blank" style="color:var(--rd-brand-purple); text-decoration:underline;">${tunnel.url} ↗</a>`;
        if (dashTunnelBtn) dashTunnelBtn.innerText = 'Stop Tunnel';
      } else {
        dashTunnelUrl.innerText = 'Tunnel is Standby (Private)';
        if (dashTunnelBtn) dashTunnelBtn.innerText = 'Start Tunnel';
      }
    }

    // Monitoring View Specific Elements
    const monBattPct = document.getElementById('monBatteryPct');
    const monBattTemp = document.getElementById('monBatteryTemp');
    const monBattVolt = document.getElementById('monBatteryVolt');
    const monBattStatus = document.getElementById('monBatteryStatus');
    if (monBattPct) monBattPct.innerText = `${batt.percentage}%`;
    if (monBattTemp) monBattTemp.innerText = `${batt.temperature}°C`;
    if (monBattVolt) monBattVolt.innerText = batt.voltage || '4.15V';
    if (monBattStatus) monBattStatus.innerText = `${batt.status} (${batt.plugged})`;

  } catch (err) {
    console.error('Failed to fetch telemetry:', err);
  }
}

// 2. Projects & Services
async function fetchProjects(render = true) {
  try {
    const res = await fetch('/api/projects');
    const json = await res.json();
    if (!json.success) return;

    allProjectsData = json.data || [];

    // Update Counts
    const countAll = document.getElementById('countAll');
    const countRunning = document.getElementById('countRunning');
    const countStopped = document.getElementById('countStopped');
    const runningCount = allProjectsData.filter(p => p.isRunning).length;

    if (countAll) countAll.innerText = allProjectsData.length;
    if (countRunning) countRunning.innerText = runningCount;
    if (countStopped) countStopped.innerText = allProjectsData.length - runningCount;

    const statActive = document.getElementById('statActiveServices');
    if (statActive) statActive.innerText = `${runningCount} / ${allProjectsData.length}`;

    // Populate Domain Modal Select
    const domainSelect = document.getElementById('newDomainService');
    if (domainSelect) {
      domainSelect.innerHTML = allProjectsData.map(p => 
        `<option value="${p.id}:${p.port}">${p.name} (Port ${p.port})</option>`
      ).join('');
    }

    if (render) {
      renderProjects(allProjectsData);
    }
  } catch (err) {
    console.error('Failed to fetch projects:', err);
  }
}

function renderProjects(projects) {
  const container = document.getElementById('projectsGrid');
  if (!container) return;
  const hostname = window.location.hostname || 'localhost';

  // Apply Search filter
  const searchInput = document.getElementById('projectSearchInput');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  let filtered = projects.filter(p => {
    const matchesSearch = !query || p.name.toLowerCase().includes(query) || (p.gitUrl && p.gitUrl.toLowerCase().includes(query));
    if (!matchesSearch) return false;

    if (currentFilter === 'running') return p.isRunning;
    if (currentFilter === 'stopped') return !p.isRunning;
    if (currentFilter === 'web-service') return p.category === 'web-service' || !p.category;
    if (currentFilter === 'static-site') return p.category === 'static-site';
    if (currentFilter === 'api') return p.category === 'api';
    return true;
  });

  let cardsHtml = filtered.map(p => {
    let statusText = '✓ All services are up and running';
    let statusClass = 'rd-status-banner';

    if (!p.isRunning && p.status === 'STOPPED') {
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
    const categoryLabel = p.category ? p.category.toUpperCase().replace('-', ' ') : 'WEB SERVICE';

    return `
      <div class="rd-project-card" id="project-${p.id}">
        <div>
          <div class="rd-card-header-row">
            <div>
              <h3 class="rd-card-project-name">${p.name}</h3>
              <span class="rd-badge rd-badge-neutral" style="font-size: 10px; margin-top: 3px;">${categoryLabel}</span>
            </div>
            <button class="rd-card-menu-btn" onclick="openLogsModal('${p.id}', '${p.name}')" title="View Logs">···</button>
          </div>
          <div style="font-size: 11px; color: var(--rd-text-sub); margin-top: 6px; font-family: monospace;">
            ${gitSource}
          </div>
        </div>

        <div>
          <div class="${statusClass}">
            ${statusText}
          </div>

          <div class="rd-card-footer-row">
            <a href="${localUrl}" target="_blank" class="rd-card-port-link">:${p.port} ↗</a>
            <div class="rd-card-actions-mini">
              <button class="rd-mini-btn" onclick="openLogsModal('${p.id}', '${p.name}')">Logs</button>
              <button class="rd-mini-btn" onclick="openEnvModal('${p.id}', '${p.name}')">Env</button>
              <button class="rd-mini-btn" onclick="redeployProject('${p.id}')">Deploy</button>
              <button class="rd-mini-btn" style="color: #ef4444;" onclick="deleteProject('${p.id}', '${p.name}')">✕</button>
              <button class="rd-mini-btn" style="${p.isRunning ? 'color:#10b981;' : 'color:var(--rd-text-sub);'}" onclick="toggleProjectPower('${p.id}', ${!p.isRunning})">
                ${p.isRunning ? '🟢 Active' : '⏸ Sleep'}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Append "+ Create new project" card
  cardsHtml += `
    <div class="rd-create-project-card" onclick="openModal('newProjectModal')">
      <span>+ Create new service</span>
    </div>
  `;

  container.innerHTML = cardsHtml;
}

// 3. Deployments View
async function fetchDeployments() {
  try {
    const res = await fetch('/api/deployments');
    const json = await res.json();
    if (!json.success) return;

    const tbody = document.getElementById('deploymentsTableBody');
    if (!tbody) return;

    const deployments = json.data || [];
    if (deployments.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="rd-td" style="text-align: center; color: var(--rd-text-sub);">No deployments recorded yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = deployments.map(d => {
      const statusBadge = d.status === 'SUCCESS' 
        ? `<span class="rd-badge rd-badge-success">Success</span>`
        : `<span class="rd-badge rd-badge-error">Failed</span>`;
      
      const commitHash = d.commit?.hash ? d.commit.hash.substring(0, 7) : 'manual';
      const commitMsg = d.commit?.message || 'Dashboard triggered deploy';

      return `
        <tr class="rd-tr">
          <td class="rd-td" style="font-family: var(--rd-font-mono); font-weight: 600;">${d.version}</td>
          <td class="rd-td" style="font-weight: 500;">${d.projectName || d.projectId}</td>
          <td class="rd-td">
            <span style="font-family: var(--rd-font-mono); font-size: 11px; color: var(--rd-brand-purple);">${commitHash}</span>
            <span style="color: var(--rd-text-muted); font-size: 12px; margin-left: 6px;">${commitMsg}</span>
          </td>
          <td class="rd-td">${statusBadge}</td>
          <td class="rd-td" style="font-family: var(--rd-font-mono); font-size: 11px;">${d.duration || '2.1s'}</td>
          <td class="rd-td" style="font-size: 12px; color: var(--rd-text-sub);">${new Date(d.deployedAt).toLocaleString()}</td>
          <td class="rd-td" style="text-align: right;">
            <button class="rd-mini-btn" onclick="openLogsModal('${d.projectId}', '${d.projectName || d.projectId}')">Logs</button>
            <button class="rd-mini-btn" onclick="rollbackProject('${d.projectId}', '${d.id}')">Rollback</button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to fetch deployments:', err);
  }
}

// 4. Networking View (Tunnels, Ports, Domains)
async function fetchNetworking() {
  try {
    // 1. Ports
    const resPorts = await fetch('/api/networking/ports');
    const jsonPorts = await resPorts.json();
    if (jsonPorts.success) {
      const tbody = document.getElementById('portsTableBody');
      if (tbody) {
        tbody.innerHTML = jsonPorts.data.map(p => `
          <tr class="rd-tr">
            <td class="rd-td" style="font-family: var(--rd-font-mono); font-weight: 600; color: var(--rd-brand-purple);">:${p.port}</td>
            <td class="rd-td">${p.projectName}</td>
            <td class="rd-td"><span class="rd-badge rd-badge-neutral">${p.protocol}</span></td>
            <td class="rd-td">
              <span class="rd-badge ${p.status === 'LISTENING' ? 'rd-badge-success' : 'rd-badge-neutral'}">
                ${p.status}
              </span>
            </td>
            <td class="rd-td">
              <a href="${p.localUrl}" target="_blank" style="color: var(--rd-brand-purple); text-decoration: underline; font-family: monospace;">${p.localUrl} ↗</a>
            </td>
          </tr>
        `).join('');
      }
    }

    // 2. Domains
    const resDom = await fetch('/api/networking/domains');
    const jsonDom = await resDom.json();
    if (jsonDom.success) {
      const tbody = document.getElementById('domainsTableBody');
      if (tbody) {
        if (jsonDom.data.length === 0) {
          tbody.innerHTML = `<tr><td colspan="5" class="rd-td" style="text-align: center; color: var(--rd-text-sub);">No custom domains configured.</td></tr>`;
        } else {
          tbody.innerHTML = jsonDom.data.map(d => `
            <tr class="rd-tr">
              <td class="rd-td" style="font-weight: 600; font-family: var(--rd-font-mono);">${d.domain}</td>
              <td class="rd-td">${d.projectId || 'General'}</td>
              <td class="rd-td" style="font-family: monospace;">:${d.port}</td>
              <td class="rd-td"><span class="rd-badge rd-badge-success">${d.sslStatus || 'ACTIVE'}</span></td>
              <td class="rd-td" style="text-align: right;">
                <button class="rd-mini-btn" style="color: #ef4444;" onclick="deleteDomain('${d.id}')">Remove</button>
              </td>
            </tr>
          `).join('');
        }
      }
    }

    // 3. Tunnel Status
    const resTunnel = await fetch('/api/tunnel');
    const jsonTunnel = await resTunnel.json();
    if (jsonTunnel.success) {
      const t = jsonTunnel.data;
      const badge = document.getElementById('netTunnelBadge');
      const btn = document.getElementById('btnStartTunnelNet');
      if (badge) {
        badge.className = t.active ? 'rd-badge rd-badge-success' : 'rd-badge rd-badge-neutral';
        badge.innerText = t.active ? `Connected (${t.url || 'Live'})` : 'Disconnected';
      }
      if (btn) {
        btn.innerText = t.active ? 'Stop Tunnel Service' : 'Start Cloudflare Tunnel';
      }
    }
  } catch (err) {
    console.error('Failed to fetch networking data:', err);
  }
}

// 5. Monitoring Processes
async function fetchProcesses() {
  try {
    const res = await fetch('/api/telemetry/processes');
    const json = await res.json();
    if (!json.success) return;

    const tbody = document.getElementById('processesTableBody');
    if (!tbody) return;

    if (json.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="rd-td" style="text-align: center; color: var(--rd-text-sub);">No running application processes.</td></tr>`;
      return;
    }

    tbody.innerHTML = json.data.map(p => `
      <tr class="rd-tr">
        <td class="rd-td" style="font-family: var(--rd-font-mono);">${p.pid}</td>
        <td class="rd-td" style="font-weight: 500;">${p.name}</td>
        <td class="rd-td" style="font-family: var(--rd-font-mono);">:${p.port}</td>
        <td class="rd-td">${p.uptimeSeconds}s</td>
        <td class="rd-td"><span class="rd-badge rd-badge-success">RUNNING</span></td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to fetch processes:', err);
  }
}

// 6. Activity Feed
async function fetchActivity() {
  try {
    const res = await fetch('/api/activity');
    const json = await res.json();
    if (!json.success) return;

    const list = document.getElementById('dashboardActivityList');
    if (!list) return;

    if (json.data.length === 0) {
      list.innerHTML = `<p style="color: var(--rd-text-sub); font-size: 12px;">No activity logged yet.</p>`;
      return;
    }

    list.innerHTML = json.data.slice(0, 8).map(act => `
      <div class="rd-activity-item">
        <div>
          <div class="rd-activity-title">
            <span class="rd-badge ${act.status === 'SUCCESS' ? 'rd-badge-success' : 'rd-badge-warn'}">${act.type}</span>
            <span>${act.title}</span>
          </div>
          <div style="font-size: 12px; color: var(--rd-text-muted); margin-top: 2px;">${act.message}</div>
        </div>
        <div class="rd-activity-time">${new Date(act.timestamp).toLocaleTimeString()}</div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to fetch activity:', err);
  }
}

// 7. Developer Webhooks
async function fetchWebhooks() {
  try {
    const res = await fetch('/api/tools/webhooks');
    const json = await res.json();
    if (!json.success) return;

    const tbody = document.getElementById('webhooksTableBody');
    if (!tbody) return;

    tbody.innerHTML = json.data.map(w => `
      <tr class="rd-tr">
        <td class="rd-td" style="font-weight: 500;">${w.projectName}</td>
        <td class="rd-td" style="font-family: var(--rd-font-mono); font-size: 12px; color: var(--rd-brand-purple);">${w.webhookUrl}</td>
        <td class="rd-td"><span class="rd-badge rd-badge-neutral">${w.contentType}</span></td>
        <td class="rd-td"><span class="rd-badge rd-badge-neutral">push</span></td>
        <td class="rd-td" style="text-align: right;">
          <button class="rd-mini-btn" onclick="copyText('${w.webhookUrl}')">Copy URL</button>
          <button class="rd-mini-btn" onclick="testWebhookPing('${w.projectId}')">Test Ping</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to fetch webhooks:', err);
  }
}

// 8. Hardware Diagnostics
async function fetchHardwareDiagnostics() {
  try {
    const res = await fetch('/api/telemetry/hardware');
    const json = await res.json();
    if (!json.success) return;

    const d = json.data;
    const arch = document.getElementById('infraArch');
    const cpu = document.getElementById('infraCpu');
    const osEl = document.getElementById('infraOs');
    const nodeEl = document.getElementById('infraNode');

    if (arch) arch.innerText = `${d.arch} (Endian: ${d.endianness})`;
    if (cpu) cpu.innerText = `${d.cpuCores} Cores · ${d.cpuModel}`;
    if (osEl) osEl.innerText = `${d.platform} (Kernel: ${d.kernelRelease})`;
    if (nodeEl) nodeEl.innerText = `${d.nodeVersion} (V8: ${d.v8Version})`;

    // WakeLock
    const wlRes = await fetch('/api/infrastructure/wakelock');
    const wlJson = await wlRes.json();
    if (wlJson.success) {
      const toggle = document.getElementById('infraWakeLockToggle');
      const text = document.getElementById('infraWakeLockText');
      if (toggle) toggle.checked = wlJson.data.wakeLock;
      if (text) text.innerText = wlJson.data.wakeLock ? 'Active (Preventing CPU Sleep)' : 'Disabled';
    }
  } catch (err) {
    console.error('Failed to fetch hardware diagnostics:', err);
  }
}

// 9. Settings
async function fetchSettings() {
  try {
    const res = await fetch('/api/settings');
    const json = await res.json();
    if (!json.success) return;

    const s = json.data;
    const nameInput = document.getElementById('setWorkspaceName');
    const portInput = document.getElementById('setDashboardPort');
    const apiKeyInput = document.getElementById('setAdminApiKey');
    const cfTokenInput = document.getElementById('integCloudflareToken');

    if (nameInput) nameInput.value = s.workspaceName || 'My Workspace';
    if (portInput) portInput.value = s.dashboardPort || 4000;
    if (apiKeyInput && s.adminApiKey) apiKeyInput.value = s.adminApiKey;
    if (cfTokenInput && s.cloudflareToken) cfTokenInput.value = s.cloudflareToken;
  } catch (err) {
    console.error('Failed to fetch settings:', err);
  }
}

// ----------------------------------------------------
// ACTIONS & CONTROLS
// ----------------------------------------------------
async function toggleProjectPower(projectId, shouldStart) {
  const endpoint = shouldStart ? `/api/projects/${projectId}/start` : `/api/projects/${projectId}/stop`;
  try {
    const res = await fetch(endpoint, { method: 'POST' });
    const json = await res.json();
    if (!json.success) alert(`Error: ${json.error}`);
    await fetchProjects();
    await fetchTelemetry();
  } catch (err) {
    alert(`Failed to toggle service: ${err.message}`);
  }
}

async function redeployProject(projectId) {
  try {
    const res = await fetch(`/api/projects/${projectId}/redeploy`, { method: 'POST' });
    const json = await res.json();
    if (!json.success) {
      alert(`Deploy failed: ${json.error}`);
    } else {
      openLogsModal(projectId, projectId);
    }
    await fetchProjects();
    await fetchDeployments();
  } catch (err) {
    alert(`Deploy failed: ${err.message}`);
  }
}

async function rollbackProject(projectId, deploymentId) {
  if (!confirm('Roll back to this previous deployment release?')) return;
  try {
    const res = await fetch(`/api/projects/${projectId}/rollback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deploymentId })
    });
    const json = await res.json();
    if (!json.success) {
      alert(`Rollback failed: ${json.error}`);
    } else {
      alert(`Rolled back successfully to ${json.data.version}!`);
      await fetchProjects();
      await fetchDeployments();
    }
  } catch (err) {
    alert(`Rollback error: ${err.message}`);
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
    await fetchTelemetry();
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
// CLOUDFLARE TUNNEL ACTIONS
// ----------------------------------------------------
function selectTunnelMode(mode) {
  tunnelMode = mode;
  const btnQuick = document.getElementById('btnTunnelQuickMode');
  const btnToken = document.getElementById('btnTunnelTokenMode');
  const tokenWrap = document.getElementById('tunnelTokenInputWrap');

  if (mode === 'token') {
    if (btnToken) btnToken.classList.add('active');
    if (btnQuick) btnQuick.classList.remove('active');
    if (tokenWrap) tokenWrap.style.display = 'block';
  } else {
    if (btnQuick) btnQuick.classList.add('active');
    if (btnToken) btnToken.classList.remove('active');
    if (tokenWrap) tokenWrap.style.display = 'none';
  }
}

async function toggleTunnelAction() {
  try {
    const statusRes = await fetch('/api/tunnel');
    const statusJson = await statusRes.json();
    const isActive = statusJson.data.active;

    if (isActive) {
      await fetch('/api/tunnel/stop', { method: 'POST' });
    } else {
      const tokenInput = document.getElementById('tunnelTokenInput');
      const token = tunnelMode === 'token' && tokenInput ? tokenInput.value.trim() : '';
      await fetch('/api/tunnel/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
    }
    await fetchTelemetry();
    await fetchNetworking();
  } catch (err) {
    alert(`Tunnel action error: ${err.message}`);
  }
}

function copyDashTunnelUrl() {
  const urlEl = document.querySelector('#dashTunnelUrl a');
  if (urlEl) {
    copyText(urlEl.innerText);
  } else {
    alert('Tunnel is not currently active.');
  }
}

// ----------------------------------------------------
// INTERACTIVE DEVELOPER TERMINAL
// ----------------------------------------------------
async function executeTerminalCommand(cmd) {
  const screen = document.getElementById('devTerminalOutput');
  const durationEl = document.getElementById('termExecDuration');
  if (!screen) return;

  screen.innerText += `\n\n$ ${cmd}\nExecuting...`;
  screen.scrollTop = screen.scrollHeight;

  try {
    const res = await fetch('/api/tools/terminal/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: cmd })
    });
    const json = await res.json();
    if (!json.success) {
      screen.innerText += `\nError: ${json.error}`;
    } else {
      const output = json.data.stdout || json.data.stderr || '(No output)';
      screen.innerText += `\n${output}`;
      if (durationEl) durationEl.innerText = `${json.data.durationMs}ms · Exit ${json.data.code}`;
    }
    screen.scrollTop = screen.scrollHeight;
  } catch (err) {
    screen.innerText += `\nFailed to connect to process manager: ${err.message}`;
  }
}

function runPresetCommand(cmd) {
  const input = document.getElementById('devTerminalInput');
  if (input) input.value = cmd;
  executeTerminalCommand(cmd);
}

async function testWebhookPing(projectId) {
  try {
    const res = await fetch(`/api/tools/webhooks/${projectId}/test`, { method: 'POST' });
    const json = await res.json();
    alert(json.message);
    await fetchActivity();
  } catch (err) {
    alert(`Ping failed: ${err.message}`);
  }
}

// ----------------------------------------------------
// DOMAIN ACTIONS
// ----------------------------------------------------
async function handleAddDomainSubmit(e) {
  e.preventDefault();
  const domain = document.getElementById('newDomainName').value.trim();
  const serviceVal = document.getElementById('newDomainService').value;
  const [projectId, port] = serviceVal.split(':');

  try {
    const res = await fetch('/api/networking/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, projectId, port })
    });
    const json = await res.json();
    if (!json.success) {
      alert(`Error: ${json.error}`);
    } else {
      closeModal('addDomainModal');
      document.getElementById('addDomainForm').reset();
      await fetchNetworking();
    }
  } catch (err) {
    alert(`Failed to add domain: ${err.message}`);
  }
}

async function deleteDomain(id) {
  if (!confirm('Remove this custom domain mapping?')) return;
  try {
    await fetch(`/api/networking/domains/${id}`, { method: 'DELETE' });
    await fetchNetworking();
  } catch (err) {
    alert(`Failed to remove domain: ${err.message}`);
  }
}

// ----------------------------------------------------
// WAKELOCK CONTROLS
// ----------------------------------------------------
async function toggleWakeLockAction(enable) {
  try {
    const res = await fetch('/api/infrastructure/wakelock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enable })
    });
    const json = await res.json();
    if (json.success) {
      const text = document.getElementById('infraWakeLockText');
      if (text) text.innerText = json.data.wakeLock ? 'Active (Preventing CPU Sleep)' : 'Disabled';
    }
  } catch (err) {
    console.error('Failed to toggle wakelock:', err);
  }
}

// ----------------------------------------------------
// SETTINGS ACTIONS
// ----------------------------------------------------
async function handleSaveGeneralSettings(e) {
  e.preventDefault();
  const workspaceName = document.getElementById('setWorkspaceName').value.trim();
  const dashboardPort = parseInt(document.getElementById('setDashboardPort').value, 10);

  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceName, dashboardPort })
    });
    const json = await res.json();
    if (json.success) {
      alert('Workspace preferences saved!');
      await fetchTelemetry();
    }
  } catch (err) {
    alert(`Save error: ${err.message}`);
  }
}

async function handleSaveSecuritySettings() {
  const adminApiKey = document.getElementById('setAdminApiKey').value.trim();
  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminApiKey })
    });
    const json = await res.json();
    if (json.success) {
      alert('Security key updated.');
    }
  } catch (err) {
    alert(`Save error: ${err.message}`);
  }
}

async function saveCloudflareToken() {
  const token = document.getElementById('integCloudflareToken').value.trim();
  try {
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cloudflareToken: token })
    });
    alert('Cloudflare token saved to node settings.');
  } catch (err) {
    alert(`Save error: ${err.message}`);
  }
}

async function handleImportBackup(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (evt) => {
    try {
      const backup = JSON.parse(evt.target.result);
      const res = await fetch('/api/backup/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backup })
      });
      const json = await res.json();
      if (json.success) {
        alert('Database and services restored successfully from backup!');
        window.location.reload();
      } else {
        alert(`Restore failed: ${json.error}`);
      }
    } catch (parseErr) {
      alert('Invalid backup JSON file.');
    }
  };
  reader.readAsText(file);
}

async function handleFactoryReset() {
  if (!confirm('DANGER: Reset all PhonixPaaS projects, settings, and deployments to factory default?')) return;
  try {
    const res = await fetch('/api/settings/reset', { method: 'POST' });
    const json = await res.json();
    if (json.success) {
      alert('Database reset to factory default.');
      window.location.reload();
    }
  } catch (err) {
    alert(`Reset failed: ${err.message}`);
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
  btn.innerText = 'Creating Service...';

  const name = document.getElementById('projectName').value.trim();
  const category = document.getElementById('projectCategory').value;
  const gitUrl = document.getElementById('gitUrl').value.trim();
  const branch = document.getElementById('gitBranch').value.trim();
  const port = document.getElementById('projectPort').value.trim();
  const buildCmd = document.getElementById('buildCmd').value.trim();
  const startCmd = document.getElementById('startCmd').value.trim();

  try {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, category, gitUrl, branch, port, buildCmd, startCmd })
    });

    const json = await res.json();
    if (!json.success) {
      alert(`Failed to create service: ${json.error}`);
    } else {
      closeModal('newProjectModal');
      document.getElementById('newProjectForm').reset();
      await fetchProjects();
      await fetchActivity();
      switchView('projects');
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
      output.innerText = json.data.length > 0 ? json.data.join('\n') : 'No output recorded yet. Toggle service on to view output.';
      output.scrollTop = output.scrollHeight;
    }
  } catch (err) {
    console.error('Error fetching logs:', err);
  }
}

function copyModalLogs() {
  const output = document.getElementById('terminalOutput');
  if (output) copyText(output.innerText);
}

// ----------------------------------------------------
// ENVIRONMENT VARIABLES MODAL
// ----------------------------------------------------
async function openEnvModal(projectId, projectName) {
  activeProjectIdForEnv = projectId;
  document.getElementById('envModalTitle').innerText = `${projectName} — Environment`;
  const container = document.getElementById('envRowsContainer');
  container.innerHTML = '<p style="color:var(--rd-text-sub); font-size:12px;">Loading variables...</p>';

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
// UTILITIES
// ----------------------------------------------------
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
  if (id === 'logsModal' && logsInterval) {
    clearInterval(logsInterval);
    logsInterval = null;
    activeProjectIdForLogs = null;
  }
  if (id === 'envModal') {
    activeProjectIdForEnv = null;
  }
}

function copyText(str) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(str);
    alert('Copied to clipboard!');
  } else {
    prompt('Copy to clipboard:', str);
  }
}