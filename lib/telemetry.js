const os = require('os');
const { exec } = require('child_process');
const fs = require('fs');

let isTermux = false;
try {
  isTermux = fs.existsSync('/data/data/com.termux') || Boolean(process.env.TERMUX_VERSION);
} catch {
  isTermux = false;
}

function getBatteryStats() {
  return new Promise((resolve) => {
    if (!isTermux) {
      // Development mode fallback (Windows / Desktop Linux / Mac)
      return resolve({
        isDevice: false,
        percentage: 100,
        plugged: 'PLUGGED_AC',
        status: 'CHARGING',
        health: 'GOOD',
        temperature: 32.0,
        simulated: true
      });
    }

    // Try executing termux-battery-status from Termux:API
    exec('termux-battery-status', { timeout: 3000 }, (error, stdout) => {
      if (error || !stdout) {
        // Termux:API package might not be installed, try reading from sysfs directly
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
    percentage: percentage || 100,
    plugged: status.toLowerCase().includes('charg') ? 'PLUGGED_AC' : 'UNPLUGGED',
    status: status || 'UNKNOWN',
    health: 'GOOD',
    temperature: temp || 30.0,
    simulated: percentage === 0
  };
}

async function getSystemTelemetry() {
  const battery = await getBatteryStats();

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memoryUsagePercent = Math.round((usedMem / totalMem) * 100);

  const cpus = os.cpus();
  const cpuModel = cpus.length > 0 ? cpus[0].model : 'Unknown ARM Processor';
  const cpuCores = cpus.length;

  return {
    platform: isTermux ? 'Android (Termux)' : `${os.type()} (${os.arch()})`,
    hostname: os.hostname(),
    uptime: Math.floor(os.uptime()),
    battery,
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
  isTermux
};
