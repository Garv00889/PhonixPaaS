const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const db = require('./lib/db');
const telemetry = require('./lib/telemetry');
const git = require('./lib/git');
const processManager = require('./lib/process-manager');
const tunnel = require('./lib/tunnel');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ----------------------------------------------------
// TELEMETRY & SYSTEM ENDPOINTS
// ----------------------------------------------------
app.get('/api/telemetry', async (req, res) => {
  try {
    const stats = await telemetry.getSystemTelemetry();
    const settings = db.getSettings();
    const tunnelStatus = tunnel.getTunnelStatus();
    res.json({
      success: true,
      data: {
        ...stats,
        masterSleep: settings.masterSleep || false,
        tunnel: tunnelStatus
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// PROJECT MANAGEMENT ENDPOINTS
// ----------------------------------------------------
app.get('/api/projects', (req, res) => {
  try {
    const projects = db.getProjects();
    // Synchronize process status
    const enriched = projects.map(p => {
      const proc = processManager.getProjectProcessStatus(p.id);
      return {
        ...p,
        isRunning: proc.isRunning,
        pid: proc.pid
      };
    });
    res.json({ success: true, data: enriched });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/projects', async (req, res) => {
  try {
    const { name, gitUrl, branch = 'main', buildCmd = '', startCmd = 'npm start', port, env = {} } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Project name is required.' });
    }

    // Auto-generate project ID from name
    const id = name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');
    const existing = db.getProjectById(id);
    if (existing) {
      return res.status(400).json({ success: false, error: `Project with name "${name}" already exists.` });
    }

    // Auto-assign port if not specified
    let assignedPort = port ? parseInt(port, 10) : null;
    if (!assignedPort) {
      const allProjects = db.getProjects();
      const usedPorts = allProjects.map(p => p.port).filter(Boolean);
      let candidate = 3001;
      while (usedPorts.includes(candidate) || candidate === PORT) {
        candidate++;
      }
      assignedPort = candidate;
    }

    const projectDir = path.join(processManager.PROJECTS_ROOT, id);

    // If git URL is provided, clone repo
    let commitInfo = null;
    if (gitUrl && gitUrl.trim()) {
      try {
        await git.cloneRepo(gitUrl.trim(), projectDir, branch.trim());
        commitInfo = await git.getLatestCommit(projectDir);
      } catch (cloneErr) {
        // Clean up partial directory if clone failed
        if (fs.existsSync(projectDir)) {
          fs.rmSync(projectDir, { recursive: true, force: true });
        }
        return res.status(400).json({ success: false, error: `Git clone failed: ${cloneErr.message}` });
      }
    } else {
      // Create empty folder with basic index.html template
      fs.mkdirSync(projectDir, { recursive: true });
      fs.writeFileSync(path.join(projectDir, 'index.html'), `<h1>Welcome to ${name} on PhonixPaaS!</h1>`, 'utf8');
      fs.writeFileSync(path.join(projectDir, 'package.json'), JSON.stringify({
        name: id,
        version: '1.0.0',
        scripts: { start: 'npx serve -l ' + assignedPort }
      }, null, 2), 'utf8');
    }

    const newProject = {
      id,
      name: name.trim(),
      gitUrl: gitUrl ? gitUrl.trim() : '',
      branch: branch ? branch.trim() : 'main',
      buildCmd: buildCmd ? buildCmd.trim() : '',
      startCmd: startCmd ? startCmd.trim() : 'npm start',
      port: assignedPort,
      env: env || {},
      status: 'STOPPED',
      lastDeployedAt: new Date().toISOString(),
      commit: commitInfo
    };

    db.saveProject(newProject);
    res.json({ success: true, data: newProject });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/projects/:id/start', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await processManager.startProject(id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/projects/:id/stop', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await processManager.stopProject(id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/projects/:id/redeploy', async (req, res) => {
  try {
    const { id } = req.params;
    const project = db.getProjectById(id);
    if (!project) return res.status(404).json({ success: false, error: 'Project not found.' });

    const projectDir = path.join(processManager.PROJECTS_ROOT, id);

    // Pull latest code if git repo exists
    if (project.gitUrl) {
      await git.pullRepo(projectDir);
      project.commit = await git.getLatestCommit(projectDir);
    }

    project.lastDeployedAt = new Date().toISOString();
    db.saveProject(project);

    // Restart project with build
    await processManager.startProject(id);
    res.json({ success: true, message: 'Redeployed successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/projects/:id/logs', (req, res) => {
  try {
    const { id } = req.params;
    const logs = processManager.getLogs(id);
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/projects/:id/env', (req, res) => {
  try {
    const { id } = req.params;
    const { env } = req.body;
    const project = db.getProjectById(id);
    if (!project) return res.status(404).json({ success: false, error: 'Project not found.' });

    project.env = env || {};
    db.saveProject(project);
    res.json({ success: true, data: project });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Stop if running
    await processManager.stopProject(id);

    // Remove folder
    const projectDir = path.join(processManager.PROJECTS_ROOT, id);
    if (fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }

    db.deleteProject(id);
    res.json({ success: true, message: `Project ${id} deleted.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// POWER & SLEEP MANAGEMENT (BATTERY SAVER)
// ----------------------------------------------------
app.post('/api/actions/sleep-all', async (req, res) => {
  try {
    await processManager.sleepAll();
    res.json({ success: true, message: 'All projects put to sleep. Phone battery preserved.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// GITHUB WEBHOOK (AUTO-DEPLOY ON GIT PUSH)
// ----------------------------------------------------
app.post('/api/webhook/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const project = db.getProjectById(id);
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    console.log(`[Webhook] Push event received for project "${project.name}". Triggering re-deployment...`);
    // Run redeploy asynchronously in background
    const projectDir = path.join(processManager.PROJECTS_ROOT, id);
    if (project.gitUrl) {
      await git.pullRepo(projectDir);
      project.commit = await git.getLatestCommit(projectDir);
    }
    project.lastDeployedAt = new Date().toISOString();
    db.saveProject(project);

    await processManager.startProject(id);
    res.json({ success: true, message: 'Deployment triggered via webhook.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// TUNNEL ENDPOINTS
// ----------------------------------------------------
app.get('/api/tunnel', (req, res) => {
  res.json({ success: true, data: tunnel.getTunnelStatus() });
});

app.post('/api/tunnel/start', async (req, res) => {
  try {
    const result = await tunnel.startQuickTunnel(PORT);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/tunnel/stop', (req, res) => {
  tunnel.stopTunnel();
  res.json({ success: true, message: 'Tunnel stopped.' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(` 🔥 PhonixPaaS is running at: http://localhost:${PORT}`);
  console.log(` 🔋 Battery-Aware Self-Hosted PaaS Engine Active`);
  console.log(`======================================================\n`);
});
