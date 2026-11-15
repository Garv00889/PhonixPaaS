const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'projects.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DEFAULT_STATE = {
  projects: [
    {
      id: "hire-my-skills",
      name: "Hire My Skills",
      category: "web-service",
      gitUrl: "https://github.com/render-examples/express-hello-world",
      branch: "main",
      port: 3001,
      buildCmd: "npm install",
      startCmd: "node app.js",
      status: "RUNNING",
      isRunning: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      env: {
        NODE_ENV: "production",
        PORT: "3001"
      },
      deployments: [
        {
          id: "dep-init-001",
          version: "v1.0.0",
          status: "SUCCESS",
          commit: {
            hash: "a4f89d1",
            message: "Initial production deployment on phone node",
            author: "Admin",
            date: new Date().toISOString()
          },
          duration: "3.2s",
          deployedAt: new Date().toISOString(),
          logs: [
            "[Phonix] Pulling from main...",
            "[Phonix] Running build: npm install",
            "[Phonix] Build completed successfully.",
            "[Phonix] Process active on port 3001."
          ]
        }
      ]
    }
  ],
  domains: [
    {
      id: "dom-001",
      domain: "hiremyskills.phonix.local",
      projectId: "hire-my-skills",
      port: 3001,
      sslStatus: "ACTIVE",
      createdAt: new Date().toISOString()
    }
  ],
  activity: [
    {
      id: "act-init-1",
      timestamp: new Date().toISOString(),
      type: "SYSTEM",
      title: "Control Plane Initialized",
      message: "PhonixPaaS engine booted on mobile POSIX runtime.",
      status: "SUCCESS"
    },
    {
      id: "act-init-2",
      timestamp: new Date().toISOString(),
      type: "DEPLOY",
      title: "Hire My Skills Deployed",
      message: "Version v1.0.0 is live on dedicated port 3001.",
      status: "SUCCESS"
    }
  ],
  settings: {
    workspaceName: "My Workspace",
    dashboardPort: 4000,
    cloudflareToken: "",
    wakeLock: false,
    masterSleep: false,
    autoSleepBattery: 20,
    autoSleepTemp: 43,
    adminApiKey: "",
    theme: "light"
  }
};

function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      writeDb(DEFAULT_STATE);
      return DEFAULT_STATE;
    }
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(content);
    // Ensure all top-level keys exist
    return {
      users: parsed.users || [],
      projects: parsed.projects || [],
      domains: parsed.domains || [],
      activity: parsed.activity || [],
      settings: { ...DEFAULT_STATE.settings, ...(parsed.settings || {}) }
    };
  } catch (err) {
    console.error('[DB] Failed to read database, falling back to default:', err.message);
    return DEFAULT_STATE;
  }
}

function writeDb(data) {
  try {
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('[DB] Failed to write database:', err.message);
  }
}

// ----------------------------------------------------
// PROJECT HELPERS
// ----------------------------------------------------
function getProjects() {
  const db = readDb();
  return db.projects || [];
}

function getProjectById(id) {
  const projects = getProjects();
  return projects.find(p => p.id === id);
}

function saveProject(projectData) {
  const db = readDb();
  const index = db.projects.findIndex(p => p.id === projectData.id);
  if (index >= 0) {
    db.projects[index] = { 
      ...db.projects[index], 
      ...projectData, 
      updatedAt: new Date().toISOString() 
    };
  } else {
    const newProj = {
      ...projectData,
      category: projectData.category || 'web-service',
      deployments: projectData.deployments || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.projects.push(newProj);
  }
  writeDb(db);
  return projectData;
}

function deleteProject(id) {
  const db = readDb();
  db.projects = db.projects.filter(p => p.id !== id);
  // Also clean up domain mappings
  db.domains = db.domains.filter(d => d.projectId !== id);
  writeDb(db);
  logActivity({
    type: 'SYSTEM',
    title: `Project Deleted`,
    message: `Project ${id} was permanently removed.`,
    status: 'WARN'
  });
}

// ----------------------------------------------------
// DEPLOYMENT HELPERS
// ----------------------------------------------------
function getDeployments(projectId = null) {
  const db = readDb();
  if (projectId) {
    const proj = db.projects.find(p => p.id === projectId);
    return proj ? (proj.deployments || []) : [];
  }
  // Global aggregate of all deployments
  const all = [];
  for (const p of db.projects) {
    for (const d of (p.deployments || [])) {
      all.push({
        ...d,
        projectId: p.id,
        projectName: p.name,
        port: p.port
      });
    }
  }
  return all.sort((a, b) => new Date(b.deployedAt) - new Date(a.deployedAt));
}

function addDeployment(projectId, depData) {
  const db = readDb();
  const proj = db.projects.find(p => p.id === projectId);
  if (!proj) return null;

  if (!proj.deployments) proj.deployments = [];
  const versionNum = proj.deployments.length + 1;
  const deployment = {
    id: `dep-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    version: depData.version || `v1.0.${versionNum}`,
    status: depData.status || 'SUCCESS',
    commit: depData.commit || {
      hash: 'local',
      message: 'Manual deployment triggered from dashboard',
      author: 'Admin',
      date: new Date().toISOString()
    },
    duration: depData.duration || '2.4s',
    deployedAt: new Date().toISOString(),
    logs: depData.logs || []
  };

  proj.deployments.unshift(deployment);
  // Limit stored deployment history to last 20
  if (proj.deployments.length > 20) {
    proj.deployments = proj.deployments.slice(0, 20);
  }
  proj.lastDeployedAt = deployment.deployedAt;

  writeDb(db);
  logActivity({
    type: 'DEPLOY',
    title: `Deployed ${proj.name}`,
    message: `Version ${deployment.version} successfully deployed.`,
    status: deployment.status === 'SUCCESS' ? 'SUCCESS' : 'ERROR'
  });
  return deployment;
}

// ----------------------------------------------------
// DOMAINS HELPERS
// ----------------------------------------------------
function getDomains() {
  const db = readDb();
  return db.domains || [];
}

function saveDomain(domainData) {
  const db = readDb();
  const index = db.domains.findIndex(d => d.id === domainData.id);
  if (index >= 0) {
    db.domains[index] = { ...db.domains[index], ...domainData };
  } else {
    db.domains.push({
      id: domainData.id || `dom-${Date.now()}`,
      domain: domainData.domain.trim().toLowerCase(),
      projectId: domainData.projectId,
      port: domainData.port,
      sslStatus: domainData.sslStatus || 'PENDING',
      createdAt: new Date().toISOString()
    });
  }
  writeDb(db);
  logActivity({
    type: 'NETWORK',
    title: 'Domain Binding Configured',
    message: `Domain ${domainData.domain} mapped to port ${domainData.port}.`,
    status: 'SUCCESS'
  });
  return domainData;
}

function deleteDomain(id) {
  const db = readDb();
  db.domains = db.domains.filter(d => d.id !== id);
  writeDb(db);
}

// ----------------------------------------------------
// ACTIVITY LOG HELPERS
// ----------------------------------------------------
function getActivities(limit = 50) {
  const db = readDb();
  const list = db.activity || [];
  return list.slice(0, limit);
}

function logActivity({ type = 'SYSTEM', title, message, status = 'SUCCESS' }) {
  const db = readDb();
  if (!db.activity) db.activity = [];
  const event = {
    id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    type,
    title,
    message,
    status
  };
  db.activity.unshift(event);
  if (db.activity.length > 150) {
    db.activity = db.activity.slice(0, 150);
  }
  writeDb(db);
  return event;
}

// ----------------------------------------------------
// SETTINGS & BACKUP HELPERS
// ----------------------------------------------------
function getSettings() {
  const db = readDb();
  return db.settings || DEFAULT_STATE.settings;
}

function updateSettings(newSettings) {
  const db = readDb();
  db.settings = { ...db.settings, ...newSettings };
  writeDb(db);
  logActivity({
    type: 'SYSTEM',
    title: 'System Settings Updated',
    message: 'Platform preferences updated successfully.',
    status: 'SUCCESS'
  });
  return db.settings;
}

function exportBackup() {
  return readDb();
}

function importBackup(data) {
  if (!data || !data.projects || !data.settings) {
    throw new Error('Invalid backup schema.');
  }
  writeDb(data);
  logActivity({
    type: 'SYSTEM',
    title: 'Database Restored',
    message: `Restored ${data.projects.length} projects and configurations from backup.`,
    status: 'SUCCESS'
  });
  return { success: true };
}

function resetDatabase() {
  writeDb(DEFAULT_STATE);
  return DEFAULT_STATE;
}

module.exports = {
  getProjects,
  getProjectById,
  saveProject,
  deleteProject,
  getDeployments,
  addDeployment,
  getDomains,
  saveDomain,
  deleteDomain,
  getActivities,
  logActivity,
  getSettings,
  updateSettings,
  exportBackup,
  importBackup,
  resetDatabase,
  readDb,
  writeDb,
  DEFAULT_STATE
};