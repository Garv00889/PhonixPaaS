const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const PROJECTS_ROOT = path.join(__dirname, '..', 'projects');

if (!fs.existsSync(PROJECTS_ROOT)) {
  fs.mkdirSync(PROJECTS_ROOT, { recursive: true });
}

// In-memory process table and log buffers
const activeProcesses = new Map(); // id -> ChildProcess
const logBuffers = new Map();      // id -> string[]

function appendLog(projectId, text) {
  if (!logBuffers.has(projectId)) {
    logBuffers.set(projectId, []);
  }
  const buffer = logBuffers.get(projectId);
  const lines = text.toString().split('\n');
  for (const line of lines) {
    if (line.trim()) {
      buffer.push(`[${new Date().toLocaleTimeString()}] ${line}`);
    }
  }
  // Keep last 250 log lines
  if (buffer.length > 250) {
    buffer.splice(0, buffer.length - 250);
  }
}

function getLogs(projectId) {
  return logBuffers.get(projectId) || [];
}

function clearLogs(projectId) {
  logBuffers.set(projectId, []);
}

function writeEnvFile(projectDir, envVars = {}) {
  const envContent = Object.entries(envVars)
    .map(([key, val]) => `${key}=${val}`)
    .join('\n');
  fs.writeFileSync(path.join(projectDir, '.env'), envContent, 'utf8');
}

function runBuild(projectId, projectDir, buildCmd) {
  return new Promise((resolve, reject) => {
    if (!buildCmd || !buildCmd.trim()) {
      return resolve();
    }
    appendLog(projectId, `[Phonix] Running build command: ${buildCmd}`);
    const isWindows = process.platform === 'win32';
    const shell = isWindows ? 'powershell.exe' : '/bin/sh';

    const buildProcess = spawn(buildCmd, {
      cwd: projectDir,
      shell: true,
      env: { ...process.env, CI: 'true' }
    });

    buildProcess.stdout.on('data', (d) => appendLog(projectId, d));
    buildProcess.stderr.on('data', (d) => appendLog(projectId, d));

    buildProcess.on('close', (code) => {
      if (code === 0) {
        appendLog(projectId, `[Phonix] Build completed successfully.`);
        resolve();
      } else {
        appendLog(projectId, `[Phonix] Build failed with exit code ${code}`);
        reject(new Error(`Build failed with code ${code}`));
      }
    });

    buildProcess.on('error', (err) => {
      appendLog(projectId, `[Phonix] Build process error: ${err.message}`);
      reject(err);
    });
  });
}

async function startProject(projectId) {
  const project = db.getProjectById(projectId);
  if (!project) throw new Error(`Project ${projectId} not found.`);

  // Stop if already running
  if (activeProcesses.has(projectId)) {
    await stopProject(projectId);
  }

  const projectDir = path.join(PROJECTS_ROOT, project.id);
  if (!fs.existsSync(projectDir)) {
    throw new Error(`Project directory does not exist at ${projectDir}`);
  }

  clearLogs(projectId);
  appendLog(projectId, `[Phonix] Starting project "${project.name}" on port ${project.port}...`);

  // 1. Write .env file
  writeEnvFile(projectDir, {
    ...project.env,
    PORT: project.port
  });

  // 2. Run build command if configured
  if (project.buildCmd) {
    db.saveProject({ ...project, status: 'BUILDING' });
    try {
      await runBuild(projectId, projectDir, project.buildCmd);
    } catch (err) {
      db.saveProject({ ...project, status: 'ERROR' });
      throw err;
    }
  }

  // 3. Spawn process
  const startCmd = project.startCmd || 'npm start';
  appendLog(projectId, `[Phonix] Executing start command: ${startCmd}`);

  const child = spawn(startCmd, {
    cwd: projectDir,
    shell: true,
    env: {
      ...process.env,
      ...project.env,
      PORT: project.port.toString()
    }
  });

  activeProcesses.set(projectId, child);
  db.saveProject({ ...project, status: 'RUNNING', pid: child.pid });

  child.stdout.on('data', (data) => appendLog(projectId, data));
  child.stderr.on('data', (data) => appendLog(projectId, data));

  child.on('close', (code) => {
    appendLog(projectId, `[Phonix] Process exited with code ${code}`);
    activeProcesses.delete(projectId);
    const curr = db.getProjectById(projectId);
    if (curr && curr.status === 'RUNNING') {
      db.saveProject({ ...curr, status: code === 0 ? 'STOPPED' : 'ERROR', pid: null });
    }
  });

  child.on('error', (err) => {
    appendLog(projectId, `[Phonix] Process failed to run: ${err.message}`);
    activeProcesses.delete(projectId);
    db.saveProject({ ...project, status: 'ERROR', pid: null });
  });

  return { success: true, pid: child.pid };
}

async function stopProject(projectId) {
  const project = db.getProjectById(projectId);
  const child = activeProcesses.get(projectId);

  if (child) {
    appendLog(projectId, `[Phonix] Stopping process (PID: ${child.pid})...`);
    try {
      if (process.platform === 'win32') {
        // Windows: taskkill to kill process tree
        exec(`taskkill /pid ${child.pid} /T /F`);
      } else {
        child.kill('SIGTERM');
      }
    } catch (err) {
      // Fallback
      child.kill();
    }
    activeProcesses.delete(projectId);
  }

  if (project) {
    db.saveProject({ ...project, status: 'STOPPED', pid: null });
  }

  return { success: true };
}

async function sleepAll() {
  const projects = db.getProjects();
  for (const p of projects) {
    if (activeProcesses.has(p.id)) {
      await stopProject(p.id);
    }
  }
  db.updateSettings({ masterSleep: true });
  return { success: true };
}

function getProjectProcessStatus(projectId) {
  const isRunning = activeProcesses.has(projectId);
  const child = activeProcesses.get(projectId);
  return {
    isRunning,
    pid: child ? child.pid : null
  };
}

module.exports = {
  startProject,
  stopProject,
  sleepAll,
  getLogs,
  clearLogs,
  getProjectProcessStatus,
  PROJECTS_ROOT
};
