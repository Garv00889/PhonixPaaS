const os = require('os');
const { exec } = require('child_process');
const fs = require('fs');

let isTermux = false;
try {
  isTermux = fs.existsSync('/data/data/com.termux') || Boolean(process.env.TERMUX_VERSION);
} catch {
  isTermux = false;
}

let inMemoryWakeLock = false;

function getBatteryStats() {
  return new Promise((resolve) => {
    if (!isTermux) {
      // Development mode fallback (Windows / Desktop Linux / Mac)
      return resolve({
        isDevice: false,
        percentage: 92,
        plugged: 'PLUGGED_AC',
        status: 'CHARGING',
        health: 'GOOD',
        temperature: 31.5,
        voltage: '4.15V',
        technology: 'Li-ion (Safe Range 20-80%)',
        simulated: true
      });
    }

    // Try executing termux-battery-status from Termux:API
    exec('termux-battery-status', { timeout: 3000 }, (error, stdout) => {
      if (error || !stdout) {
        return resolve(readBatterySysfs());
      }
      try {
        const data = JSON.parse(stdout);
        resolve({
          isDevice: true,
          percentage: data.percentage ?? 0,
          plugged: data.plugged ?? 'UNKNOWN',
          status: data.status ?? 'UNKNOWN',
          health: data.health ?? 'GOOD',
          temperature: data.temperature ?? 0,
          voltage: data.voltage ? `${(data.voltage / 1000).toFixed(2)}V` : '3.85V',
          technology: 'Li-ion',
          simulated: false
        });
      } catch {
        resolve(readBatterySysfs());
      }
    });
  });
}

function readBatterySysfs() {
  let percentage = 0;
  let status = 'DISCHARGING';
  let temp = 0;

  try {
    if (fs.existsSync('/sys/class/power_supply/battery/capacity')) {
      percentage = parseInt(fs.readFileSync('/sys/class/power_supply/battery/capacity', 'utf8').trim(), 10);
    }
    if (fs.existsSync('/sys/class/power_supply/battery/status')) {
      status = fs.readFileSync('/sys/class/power_supply/battery/status', 'utf8').trim();
    }
    if (fs.existsSync('/sys/class/power_supply/battery/temp')) {
      temp = parseInt(fs.readFileSync('/sys/class/power_supply/battery/temp', 'utf8').trim(), 10) / 10;
    }
  } catch {
    // Ignore sysfs read errors
  }

  return {
    isDevice: isTermux,
    percentage: percentage || 88,
    plugged: status.toLowerCase().includes('charg') ? 'PLUGGED_AC' : 'UNPLUGGED',
    status: status || 'CHARGING',
    health: 'GOOD',
    temperature: temp || 31.0,
    voltage: '4.10V',
    technology: 'Li-ion',
    simulated: percentage === 0
  };
}

function getStorageStats() {
  try {
    if (typeof fs.statfsSync === 'function') {
      const stats = fs.statfsSync('.');
      const bsize = stats.bsize || 4096;
      const totalBytes = Number(stats.blocks) * bsize;
      const freeBytes = Number(stats.bavail || stats.bfree) * bsize;
      const usedBytes = totalBytes - freeBytes;

      const totalGB = (totalBytes / (1024 * 1024 * 1024)).toFixed(1);
      const freeGB = (freeBytes / (1024 * 1024 * 1024)).toFixed(1);
      const usedGB = (usedBytes / (1024 * 1024 * 1024)).toFixed(1);
      const percentage = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;

      return {
        totalGB: parseFloat(totalGB),
        freeGB: parseFloat(freeGB),
        usedGB: parseFloat(usedGB),
        percentage
      };
    }
  } catch (err) {
    console.error('[Telemetry] statfs failed:', err.message);
  }

  // Fallback
  return {
    totalGB: 64.0,
    freeGB: 41.5,
    usedGB: 22.5,
    percentage: 35
  };
}

function getWakeLockStatus() {
  return inMemoryWakeLock;
}

function toggleWakeLock(enable) {
  inMemoryWakeLock = Boolean(enable);
  if (isTermux) {
    const cmd = enable ? 'termux-wake-lock' : 'termux-wake-unlock';
    exec(cmd, (err) => {
      if (err) console.error(`[Telemetry] Failed to toggle wakelock (${cmd}):`, err.message);
    });
  }
  return inMemoryWakeLock;
}

function getHardwareDiagnostics() {
  const cpus = os.cpus();
  const memoryTotal = Math.round(os.totalmem() / (1024 * 1024));
  const memoryFree = Math.round(os.freemem() / (1024 * 1024));

  return {
    isTermux,
    platform: isTermux ? 'Android (Termux POSIX User Space)' : `${os.type()} (${os.platform()})`,
    arch: os.arch(),
    kernelRelease: os.release(),
    hostname: os.hostname(),
    uptimeSeconds: Math.floor(os.uptime()),
    nodeVersion: process.version,
    v8Version: process.versions.v8,
    cpuModel: cpus.length > 0 ? cpus[0].model : 'ARM64 Mobile SoC',
    cpuCores: cpus.length,
    cpuSpeedMHz: cpus.length > 0 ? cpus[0].speed : 2400,
    endianness: os.endianness(),
    memoryTotalMB: memoryTotal,
    memoryFreeMB: memoryFree
  };
}

async function getSystemTelemetry() {
  const battery = await getBatteryStats();
  const storage = getStorageStats();

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memoryUsagePercent = Math.round((usedMem / totalMem) * 100);

  const cpus = os.cpus();
  const cpuModel = cpus.length > 0 ? cpus[0].model : 'ARM64 Mobile SoC';
  const cpuCores = cpus.length;

  return {
    platform: isTermux ? 'Android (Termux)' : `${os.type()} (${os.arch()})`,
    hostname: os.hostname(),
    uptime: Math.floor(os.uptime()),
    battery,
    storage,
    wakeLock: inMemoryWakeLock,
    memory: {
      total: Math.round(totalMem / (1024 * 1024)), // MB
      used: Math.round(usedMem / (1024 * 1024)),   // MB
      free: Math.round(freeMem / (1024 * 1024)),   // MB
      percentage: memoryUsagePercent
    },
    cpu: {
      model: cpuModel,
      cores: cpuCores,
      loadAvg: os.loadavg()
    }
  };
}

module.exports = {
  getSystemTelemetry,
  getBatteryStats,
  getStorageStats,
  getWakeLockStatus,
  toggleWakeLock,
  getHardwareDiagnostics,
  isTermux
};