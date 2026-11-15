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
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Optional API Key protection middleware for admin write actions
app.use((req, res, next) => {
  const settings = db.getSettings();
  if (settings.adminApiKey && settings.adminApiKey.trim()) {
    // Only check write methods (POST, PUT, DELETE) except webhooks
    if (['POST', 'PUT', 'DELETE'].includes(req.method) && !req.path.startsWith('/api/webhook/')) {
      const authHeader = req.headers['x-api-key'] || req.headers['authorization'];
      if (!authHeader || !authHeader.includes(settings.adminApiKey.trim())) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Admin API key required.' });
      }
    }
  }
  next();
});

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
        workspaceName: settings.workspaceName || 'My Workspace',
        masterSleep: settings.masterSleep || false,
        tunnel: tunnelStatus
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/telemetry/hardware', (req, res) => {
  try {
    const diag = telemetry.getHardwareDiagnostics();
    res.json({ success: true, data: diag });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/telemetry/storage', (req, res) => {
  try {
    const storage = telemetry.getStorageStats();
    res.json({ success: true, data: storage });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/telemetry/processes', (req, res) => {
  try {
    const procs = processManager.getRunningProcesses();
    res.json({ success: true, data: procs });
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
    const enriched = projects.map(p => {
      const proc = processManager.getProjectProcessStatus(p.id);
      return {
        ...p,
        isRunning: proc.isRunning,
        pid: proc.pid,
        uptimeSeconds: proc.uptimeSeconds
      };
    });
    res.json({ success: true, data: enriched });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/projects', async (req, res) => {
  try {
    const { 
      name, 
      category = 'web-service', 
      gitUrl, 
      branch = 'main', 
      buildCmd = '', 
      startCmd = 'npm start', 
      port, 
      env = {} 
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Project name is required.' });
    }

    const id = name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');
    const existing = db.getProjectById(id);
    if (existing) {
      return res.status(400).json({ success: false, error: `Project with name "${name}" already exists.` });
    }

    // Auto-assign port
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

    let commitInfo = null;
    if (gitUrl && gitUrl.trim()) {
      try {
        await git.cloneRepo(gitUrl.trim(), projectDir, branch.trim());
        commitInfo = await git.getLatestCommit(projectDir);
      } catch (cloneErr) {
        if (fs.existsSync(projectDir)) {
          fs.rmSync(projectDir, { recursive: true, force: true });
        }
        return res.status(400).json({ success: false, error: `Git clone failed: ${cloneErr.message}` });
      }
    } else {
      fs.mkdirSync(projectDir, { recursive: true });
      fs.writeFileSync(path.join(projectDir, 'index.html'), `<!DOCTYPE html><html><body><h1>Welcome to ${name} on PhonixPaaS!</h1><p>Self-hosted on recycled mobile hardware.</p></body></html>`, 'utf8');
      fs.writeFileSync(path.join(projectDir, 'package.json'), JSON.stringify({
        name: id,
        version: '1.0.0',
        scripts: { start: 'npx serve -l ' + assignedPort }
      }, null, 2), 'utf8');
    }

    const newProject = {
      id,
      name: name.trim(),
      category: category || 'web-service',
      gitUrl: gitUrl ? gitUrl.trim() : '',
      branch: branch ? branch.trim() : 'main',
      buildCmd: buildCmd ? buildCmd.trim() : '',
      startCmd: startCmd ? startCmd.trim() : 'npm start',
      port: assignedPort,
      env: env || {},
      status: 'STOPPED',
      lastDeployedAt: new Date().toISOString(),
      commit: commitInfo,
      deployments: [
        {
          id: `dep-${Date.now()}`,
          version: 'v1.0.0',
          status: 'SUCCESS',
          commit: commitInfo || { hash: 'init', message: 'Initial project creation', author: 'Admin' },
          duration: '1.2s',
          deployedAt: new Date().toISOString(),
          logs: [`[Phonix] Project "${name}" initialized successfully.`]
        }
      ]
    };

    db.saveProject(newProject);
    db.logActivity({
      type: 'SYSTEM',
      title: 'Project Created',
      message: `Created project "${name}" (${category}) assigned to port ${assignedPort}.`,
      status: 'SUCCESS'
    });

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

    if (project.gitUrl) {
      await git.pullRepo(projectDir);
      project.commit = await git.getLatestCommit(projectDir);
      db.saveProject(project);
    }

    await processManager.startProject(id);
    res.json({ success: true, message: 'Redeployed successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/projects/:id/rollback', async (req, res) => {
  try {
    const { id } = req.params;
    const { deploymentId } = req.body;
    if (!deploymentId) {
      return res.status(400).json({ success: false, error: 'deploymentId is required.' });
    }
    const result = await processManager.rollbackProject(id, deploymentId);
    res.json({ success: true, data: result });
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
    db.logActivity({
      type: 'ENV',
      title: 'Environment Updated',
      message: `Environment variables updated for ${project.name}.`,
      status: 'SUCCESS'
    });
    res.json({ success: true, data: project });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await processManager.stopProject(id);

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
// DEPLOYMENTS ENDPOINT
// ----------------------------------------------------
app.get('/api/deployments', (req, res) => {
  try {
    const { projectId } = req.query;
    const deployments = db.getDeployments(projectId || null);
    res.json({ success: true, data: deployments });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// NETWORKING & DOMAINS ENDPOINTS
// ----------------------------------------------------
app.get('/api/networking/domains', (req, res) => {
  try {
    const domains = db.getDomains();
    res.json({ success: true, data: domains });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/networking/domains', (req, res) => {
  try {
    const { domain, projectId, port } = req.body;
    if (!domain || !domain.trim()) {
      return res.status(400).json({ success: false, error: 'Domain name is required.' });
    }
    const saved = db.saveDomain({
      domain: domain.trim(),
      projectId: projectId || null,
      port: port ? parseInt(port, 10) : 3001,
      sslStatus: 'ACTIVE'
    });
    res.json({ success: true, data: saved });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/networking/domains/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.deleteDomain(id);
    res.json({ success: true, message: 'Domain removed.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/networking/ports', (req, res) => {
  try {
    const projects = db.getProjects();
    const ports = projects.map(p => {
      const proc = processManager.getProjectProcessStatus(p.id);
      return {
        port: p.port,
        projectId: p.id,
        projectName: p.name,
        protocol: 'HTTP/TCP',
        status: proc.isRunning ? 'LISTENING' : 'STANDBY',
        localUrl: `http://localhost:${p.port}`
      };
    });
    // Add dashboard control plane port
    ports.unshift({
      port: PORT,
      projectId: 'control-plane',
      projectName: 'PhonixPaaS Dashboard',
      protocol: 'HTTP/WS',
      status: 'LISTENING',
      localUrl: `http://localhost:${PORT}`
    });
    res.json({ success: true, data: ports });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
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
    const { token } = req.body;
    let result;
    if (token && token.trim()) {
      result = await tunnel.startTokenTunnel(token.trim());
    } else {
      result = await tunnel.startQuickTunnel(PORT);
    }
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/tunnel/stop', (req, res) => {
  tunnel.stopTunnel();
  res.json({ success: true, message: 'Tunnel stopped.' });
});

// ----------------------------------------------------
// DEVELOPER TOOLS: INTERACTIVE TERMINAL & WEBHOOKS
// ----------------------------------------------------
app.post('/api/tools/terminal/exec', async (req, res) => {
  try {
    const { command } = req.body;
    if (!command || !command.trim()) {
      return res.status(400).json({ success: false, error: 'Command string is required.' });
    }
    const result = await processManager.executeCommand(command);
    db.logActivity({
      type: 'SYSTEM',
      title: 'Console Executed',
      message: `$ ${command.trim().substring(0, 40)} (Code: ${result.code})`,
      status: result.code === 0 ? 'SUCCESS' : 'WARN'
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/tools/webhooks', (req, res) => {
  try {
    const hostname = req.hostname || 'localhost';
    const projects = db.getProjects();
    const list = projects.map(p => ({
      projectId: p.id,
      projectName: p.name,
      gitUrl: p.gitUrl,
      webhookUrl: `http://${hostname}:${PORT}/api/webhook/${p.id}`,
      contentType: 'application/json',
      events: ['push']
    }));
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/tools/webhooks/:id/test', async (req, res) => {
  try {
    const { id } = req.params;
    const project = db.getProjectById(id);
    if (!project) return res.status(404).json({ success: false, error: 'Project not found.' });

    db.logActivity({
      type: 'DEPLOY',
      title: `Webhook Test Ping: ${project.name}`,
      message: 'Simulated GitHub push payload processed.',
      status: 'SUCCESS'
    });
    res.json({ success: true, message: `Webhook test ping delivered to ${project.name}.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// INFRASTRUCTURE & WAKELOCK CONTROLS
// ----------------------------------------------------
app.get('/api/infrastructure/wakelock', (req, res) => {
  res.json({ success: true, data: { wakeLock: telemetry.getWakeLockStatus() } });
});

app.post('/api/infrastructure/wakelock', (req, res) => {
  try {
    const { enable } = req.body;
    const active = telemetry.toggleWakeLock(enable);
    db.updateSettings({ wakeLock: active });
    db.logActivity({
      type: 'SYSTEM',
      title: active ? 'Android WakeLock Acquired' : 'Android WakeLock Released',
      message: active ? 'CPU will stay awake when screen is off.' : 'CPU may sleep per OEM power saver.',
      status: active ? 'SUCCESS' : 'WARN'
    });
    res.json({ success: true, data: { wakeLock: active } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// ACTIVITY LOG & SETTINGS
// ----------------------------------------------------
app.get('/api/activity', (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const activities = db.getActivities(limit);
    res.json({ success: true, data: activities });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/settings', (req, res) => {
  try {
    const settings = db.getSettings();
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/settings', (req, res) => {
  try {
    const updated = db.updateSettings(req.body);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/backup/export', (req, res) => {
  try {
    const backup = db.exportBackup();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="phonix-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.send(JSON.stringify(backup, null, 2));
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/backup/import', (req, res) => {
  try {
    const { backup } = req.body;
    db.importBackup(backup);
    res.json({ success: true, message: 'Backup restored successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/settings/reset', (req, res) => {
  try {
    const result = db.resetDatabase();
    res.json({ success: true, message: 'Database reset to factory default.', data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

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

    console.log(`[Webhook] Push event received for "${project.name}". Triggering deployment...`);
    const projectDir = path.join(processManager.PROJECTS_ROOT, id);
    if (project.gitUrl) {
      await git.pullRepo(projectDir);
      project.commit = await git.getLatestCommit(projectDir);
      db.saveProject(project);
    }

    await processManager.startProject(id);
    db.logActivity({
      type: 'DEPLOY',
      title: `Git Push Received: ${project.name}`,
      message: `Triggered automated rebuild and deploy on main branch.`,
      status: 'SUCCESS'
    });

    res.json({ success: true, message: 'Deployment triggered via webhook.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(` 🔥 PhonixPaaS is running at: http://localhost:${PORT}`);
  console.log(` 🔋 Battery-Aware Self-Hosted PaaS Engine Active`);
  console.log(`======================================================\n`);
});