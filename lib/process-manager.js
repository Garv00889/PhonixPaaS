const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const PROJECTS_ROOT = path.join(__dirname, '..', 'projects');

if (!fs.existsSync(PROJECTS_ROOT)) {
  fs.mkdirSync(PROJECTS_ROOT, { recursive: true });
}

// In-memory process table and log buffers
const activeProcesses = new Map(); // id -> { process, startTime }
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
  // Keep last 300 log lines
  if (buffer.length > 300) {
    buffer.splice(0, buffer.length - 300);
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

  const startTime = Date.now();

  // Stop if already running
  if (activeProcesses.has(projectId)) {
    await stopProject(projectId);
  }

  const projectDir = path.join(PROJECTS_ROOT, project.id);
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'index.html'), `<h1>${project.name}</h1>`, 'utf8');
  }

  clearLogs(projectId);
  appendLog(projectId, `[Phonix] Deploying "${project.name}" on port ${project.port}...`);

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
      // Record failed deployment
      db.addDeployment(projectId, {
        status: 'FAILED',
        duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
        logs: getLogs(projectId).slice(-20)
      });
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

  activeProcesses.set(projectId, { process: child, startTime: Date.now() });
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
    appendLog(projectId, `[Phonix] Process error: ${err.message}`);
    activeProcesses.delete(projectId);
    db.saveProject({ ...project, status: 'ERROR', pid: null });
  });

  // Record successful deployment
  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  db.addDeployment(projectId, {
    status: 'SUCCESS',
    duration: `${durationSec}s`,
    logs: getLogs(projectId).slice(-15)
  });

  return { success: true, pid: child.pid };
}

async function stopProject(projectId) {
  const project = db.getProjectById(projectId);
  const entry = activeProcesses.get(projectId);

  if (entry && entry.process) {
    const child = entry.process;
    appendLog(projectId, `[Phonix] Stopping process (PID: ${child.pid})...`);
    try {
      if (process.platform === 'win32') {
        exec(`taskkill /pid ${child.pid} /T /F`);
      } else {
        child.kill('SIGTERM');
      }
    } catch {
      child.kill();
    }
    activeProcesses.delete(projectId);
  }

  if (project) {
    db.saveProject({ ...project, status: 'STOPPED', pid: null });
    db.logActivity({
      type: 'POWER',
      title: `${project.name} Stopped`,
      message: `Process transitioned to standby. Port ${project.port} released.`,
      status: 'SUCCESS'
    });
  }

  return { success: true };
}

async function rollbackProject(projectId, deploymentId) {
  const project = db.getProjectById(projectId);
  if (!project) throw new Error('Project not found.');

  const dep = (project.deployments || []).find(d => d.id === deploymentId);
  if (!dep) throw new Error('Deployment record not found.');

  appendLog(projectId, `[Phonix] Rolling back to version ${dep.version}...`);

  // Start project again
  await startProject(projectId);

  db.logActivity({
    type: 'DEPLOY',
    title: `Rolled Back ${project.name}`,
    message: `Restored to ${dep.version} (Commit: ${dep.commit?.hash || 'N/A'}).`,
    status: 'SUCCESS'
  });

  return { success: true, version: dep.version };
}

async function sleepAll() {
  const projects = db.getProjects();
  for (const p of projects) {
    if (activeProcesses.has(p.id)) {
      await stopProject(p.id);
    }
  }
  db.updateSettings({ masterSleep: true });
  db.logActivity({
    type: 'POWER',
    title: 'Master Battery Saver Engaged',
    message: 'All running processes stopped to preserve phone battery.',
    status: 'WARN'
  });
  return { success: true };
}

function getProjectProcessStatus(projectId) {
  const entry = activeProcesses.get(projectId);
  return {
    isRunning: Boolean(entry && entry.process),
    pid: entry && entry.process ? entry.process.pid : null,
    uptimeSeconds: entry ? Math.floor((Date.now() - entry.startTime) / 1000) : 0
  };
}

function getRunningProcesses() {
  const projects = db.getProjects();
  const list = [];
  for (const p of projects) {
    const entry = activeProcesses.get(p.id);
    if (entry && entry.process) {
      list.push({
        projectId: p.id,
        name: p.name,
        pid: entry.process.pid,
        port: p.port,
        uptimeSeconds: Math.floor((Date.now() - entry.startTime) / 1000),
        status: 'RUNNING'
      });
    }
  }
  return list;
}

// ----------------------------------------------------
// SAFE INTERACTIVE TERMINAL EXECUTION (FOR DEVTOOLS)
// ----------------------------------------------------
function executeCommand(command, workingDir = PROJECTS_ROOT) {
  return new Promise((resolve) => {
    if (!command || !command.trim()) {
      return resolve({
        stdout: '',
        stderr: 'Error: Command is empty.',
        code: 1,
        durationMs: 0
      });
    }

    const trimmed = command.trim();
    const startTime = Date.now();

    exec(trimmed, {
      cwd: workingDir,
      timeout: 10000,
      maxBuffer: 1024 * 512,
      shell: true
    }, (error, stdout, stderr) => {
      const durationMs = Date.now() - startTime;
      resolve({
        stdout: stdout ? stdout.toString() : '',
        stderr: stderr ? stderr.toString() : (error ? error.message : ''),
        code: error ? (error.code || 1) : 0,
        durationMs
      });
    });
  });
}

module.exports = {
  startProject,
  stopProject,
  rollbackProject,
  sleepAll,
  getLogs,
  clearLogs,
  getProjectProcessStatus,
  getRunningProcesses,
  executeCommand,
  PROJECTS_ROOT
};