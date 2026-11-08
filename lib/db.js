const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'projects.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DEFAULT_STATE = {
  projects: [],
  settings: {
    dashboardPort: 4000,
    cloudflareToken: '',
    masterSleep: false
  }
};

function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      writeDb(DEFAULT_STATE);
      return DEFAULT_STATE;
    }
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(content);
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

// Project helpers
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
    db.projects[index] = { ...db.projects[index], ...projectData, updatedAt: new Date().toISOString() };
  } else {
    db.projects.push({
      ...projectData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  writeDb(db);
  return projectData;
}

function deleteProject(id) {
  const db = readDb();
  db.projects = db.projects.filter(p => p.id !== id);
  writeDb(db);
}

function getSettings() {
  const db = readDb();
  return db.settings || DEFAULT_STATE.settings;
}

function updateSettings(newSettings) {
  const db = readDb();
  db.settings = { ...db.settings, ...newSettings };
  writeDb(db);
  return db.settings;
}

module.exports = {
  getProjects,
  getProjectById,
  saveProject,
  deleteProject,
  getSettings,
  updateSettings
};
