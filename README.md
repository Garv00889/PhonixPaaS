# 🔥 PhonixPaaS

> **The battery-aware, self-hosted Platform-as-a-Service (PaaS) that turns any old Android phone into a personal cloud server.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform: Android Termux](https://img.shields.io/badge/Platform-Android%20%7C%20Linux%20%7C%20Windows-green.svg)](https://termux.dev)
[![Architecture: ARM64](https://img.shields.io/badge/Arch-ARM64%20%7C%20x86__64-orange.svg)](#)
[![Dockerless](https://img.shields.io/badge/Runtime-Dockerless%20%28%3C35MB%20RAM%29-purple.svg)](#)

> 📖 **Read the Full Step-by-Step Guide**: [PHONE_SERVER_GUIDE.md](PHONE_SERVER_GUIDE.md) — A complete walkthrough on converting any old phone into a personal cloud server.

---

## 💡 Why PhonixPaaS?

Cloud platforms like **Render**, **Vercel**, and **Heroku** charge monthly fees or enforce aggressive cold-starts on their free tiers. Meanwhile, millions of old smartphones with 4GB+ RAM and multi-core processors sit unused in drawers.

However, standard self-hosted PaaS tools (like **Coolify** or **Dokku**) **cannot run on Android**:
* They strictly require **Docker** and Linux `systemd` kernel namespaces (which Android blocks).
* They consume **2GB–4GB+ RAM** just for the platform itself.
* They have **zero battery awareness**, causing phone batteries to overheat or swell if left running heavy processes 24/7.

**PhonixPaaS solves this completely.** It is a native, Dockerless PaaS engine engineered specifically for resource-constrained edge hardware.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PHONIXPAAS ARCHITECTURE                         │
│                                                                        │
│  [ Web Dashboard (Port 4000) ]  <─── Control from your Laptop Browser  │
│         │                                                              │
│         ├── Telemetry Engine  ────> Reads Battery % & Temperature      │
│         ├── Git Auto-Deployer ────> Clones & Builds Repositories       │
│         ├── Environment Mgr   ────> Injects .env configs on launch     │
│         └── Power Controller  ────> Toggles Projects LIVE / STANDBY    │
│                                                                        │
│  [ Hosted Projects ]                                                   │
│  • Portfolio Site   (:3001)   [ 🟢 LIVE ]                              │
│  • Backend REST API (:3002)   [ ⏸️ STANDBY ] (Saves CPU & Battery)    │
│  • Python Data App  (:3003)   [ ⏸️ STANDBY ]                          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## ✨ Features

* 📱 **Runs on Stock Android:** Zero root or custom ROMs required. Runs seamlessly inside [Termux](https://termux.dev).
* 🔋 **Battery & Thermal Protection:** Live telemetry monitors battery level, charging state, and CPU temperature.
* ⏸️ **"Scale-to-Zero" Power Saving:** One-click toggles put websites into standby mode when you are not actively showcasing them, dropping CPU load to 0% and preserving battery life.
* 📦 **Dockerless Process Isolation:** Uses native process trees instead of heavy container daemons. Consumes under **35MB RAM**, leaving 95%+ of memory free for your apps.
* 🔄 **Git-Driven Deployments:** Pulls from GitHub repositories, runs custom build commands (`npm install && npm run build`), and starts your projects automatically.
* ⚙️ **Visual `.env` Manager:** Configure database secrets, API keys, and custom ports directly from your browser.
* 🌐 **Built-in Cloudflare Tunnel:** Expose your projects to the internet with free, zero-config HTTPS URLs without touching router port-forwarding.
* 📋 **Real-Time Streaming Logs:** View live terminal stdout/stderr logs directly from the dashboard to debug builds and runtime errors.

---

## 🚀 Quick Start on Android (Old Phone)

### 1. Prerequisites on the Phone
1. Install **Termux** from [F-Droid](https://f-droid.org/en/packages/com.termux/) *(Do not use the Google Play Store version as it is deprecated)*.
2. Install **Termux:API** from [F-Droid](https://f-droid.org/en/packages/com.termux.api/) (enables hardware battery & thermal reading).
3. Disable Android Battery Optimization for Termux:
   * **Settings $\to$ Apps $\to$ Termux $\to$ Battery $\to$ Unrestricted**.

### 2. One-Line Installation
Open Termux on the phone and run:
```bash
pkg install -y git && git clone https://github.com/your-username/phonix-paas.git ~/phonix-paas && cd ~/phonix-paas && bash scripts/install.sh
```

### 3. Open the Dashboard
On your laptop or primary phone connected to the same Wi-Fi, open your browser and go to:
```text
http://<phone-ip-address>:4000
```
*(Your phone's Wi-Fi IP is printed in Termux by running `ifconfig wlan0`)*.

---

## 💻 Local Testing & Development (On PC / Mac / Linux)

You can also run and test PhonixPaaS right on your laptop before deploying it to your phone:

```bash
# 1. Clone the repository
git clone https://github.com/your-username/phonix-paas.git
cd phonix-paas

# 2. Install dependencies
npm install

# 3. Start PhonixPaaS
npm start
```
Open **`http://localhost:4000`** in your browser.

---

## 🔋 Hardware Safety & Battery Best Practices

When running an old phone as a home server, follow these hardware safety tips:
1. **Prevent Battery Swelling:** Do not keep the battery continuously at 100% on a hot charger for months. Use a smart plug or charge-limiting app (e.g. *AccuBattery* or root *acc*) to cycle power between 20% and 80%.
2. **Keep It Cool:** Place the phone in an open, well-ventilated area (not inside a drawer or direct sunlight).
3. **Use the "Sleep All" Feature:** When you are done demonstrating your projects, use the dashboard's **Sleep All** button so the processor rests.

---

## 🛠️ Tech Stack

* **Core Engine:** Node.js, Express
* **Frontend Dashboard:** Vanilla JavaScript, CSS Glassmorphism, JetBrains Mono
* **Hardware Telemetry:** Termux:API, Linux sysfs (`/sys/class/power_supply`)
* **Tunneling:** Cloudflare Tunnel (`cloudflared`)

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
