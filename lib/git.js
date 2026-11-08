const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

function runGitCommand(cmd, cwd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd, timeout: 120000 }, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(stderr || stdout || error.message));
      }
      resolve(stdout.trim());
    });
  });
}

async function cloneRepo(gitUrl, targetDir, branch = 'main') {
  if (fs.existsSync(targetDir)) {
    throw new Error(`Target directory already exists: ${targetDir}`);
  }
  // Safe sanitized git clone
  const cmd = `git clone --branch ${branch} --single-branch ${gitUrl} "${targetDir}"`;
  return runGitCommand(cmd, process.cwd());
}

async function pullRepo(targetDir) {
  if (!fs.existsSync(targetDir)) {
    throw new Error(`Project directory not found: ${targetDir}`);
  }
  return runGitCommand('git pull', targetDir);
}

async function getLatestCommit(targetDir) {
  if (!fs.existsSync(targetDir)) return null;
  try {
    const raw = await runGitCommand('git log -1 --pretty=format:"%H|%s|%an|%cI"', targetDir);
    const [hash, message, author, date] = raw.split('|');
    return {
      hash: hash ? hash.substring(0, 7) : 'unknown',
      fullHash: hash,
      message: message || 'Initial commit',
      author: author || 'Unknown',
      date: date || new Date().toISOString()
    };
  } catch (err) {
    return {
      hash: 'local',
      message: 'Local or untracked state',
      author: 'system',
      date: new Date().toISOString()
    };
  }
}

module.exports = {
  cloneRepo,
  pullRepo,
  getLatestCommit
};
