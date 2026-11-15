# 📱 The Complete Guide: Turning an Old Phone into a Personal Cloud Server

> **A comprehensive blueprint on how PhonixPaaS converts recycled mobile hardware into a battery-aware, self-hosted Platform-as-a-Service (PaaS) like Render or Vercel.**

---

## 📑 Table of Contents
1. [Introduction: What Are We Building?](#1-introduction-what-are-we-building)
2. [The Core Concept: How a Phone Becomes a Server](#2-the-core-concept-how-a-phone-becomes-a-server)
3. [Architecture: Control Plane vs. Data Plane](#3-architecture-control-plane-vs-data-plane)
4. [Step-by-Step Setup Guide](#4-step-by-step-setup-guide)
   - [Phase 1: Preparing the Old Phone](#phase-1-preparing-the-old-phone)
   - [Phase 2: Setting Up the Linux Runtime (Termux)](#phase-2-setting-up-the-linux-runtime-termux)
   - [Phase 3: Installing PhonixPaaS](#phase-3-installing-phonixpaas)
   - [Phase 4: Remote Management from Your Laptop](#phase-4-remote-management-from-your-laptop)
5. [Connecting to the World: Free HTTPS Without Port Forwarding](#5-connecting-to-the-world-free-https-without-port-forwarding)
6. [Automated CI/CD: Deploy on `git push`](#6-automated-cicd-deploy-on-git-push)
7. [Hardware Care: Battery Swelling & Thermal Protection](#7-hardware-care-battery-swelling--thermal-protection)
8. [Troubleshooting & Quick Cheatsheet](#8-troubleshooting--quick-cheatsheet)

---

## 1. Introduction: What Are We Building?

When hosting personal portfolios, client demos, or backend APIs, developers typically rely on platforms like **Render**, **Vercel**, or **Heroku**. However:
* Free tiers enforce **cold starts** (1-minute delays when someone opens your link).
* Paid cloud servers cost \$5–\$20+ every month.
* Meanwhile, millions of old smartphones with 3GB–6GB of RAM and multi-core processors sit unused in drawers.

**PhonixPaaS** solves this by turning any old Android smartphone into an on-demand, self-hosted cloud platform with:
* An **Admin Web Dashboard** (rendered with Render’s dark-mode design system).
* A **Project Manager** that clones Git repositories, sets `.env` variables, and runs builds.
* An **On-Demand Power Switch ("Scale-to-Zero")** to turn websites on/off with one click, keeping the phone cool and protecting battery health.
* **Global HTTPS Access** via free Cloudflare Tunnels (no static IP or router port forwarding needed).

---

## 2. The Core Concept: How a Phone Becomes a Server

### What Actually Is a Server?
A server is **not** a mysterious supercomputer. It is simply any computer running a software program that listens on a network port (e.g., port `3000` or `4000`) and serves files or data when someone requests them.

### Why Smartphones Are Ideal Servers
If you look inside a smartphone, you have:
* **CPU:** Multi-core ARM processor (Snapdragon, MediaTek, Exynos) — extremely power-efficient (2–5 Watts vs. 60–100W for a PC).
* **RAM:** 2GB to 6GB (plenty for running Node.js, Python, or static web servers).
* **Storage:** Fast UFS / eMMC flash storage (32GB–128GB).
* **Built-in UPS (Battery Backup):** If your home electricity cuts out, your server stays online!
* **Operating System:** **Android is built directly on top of the Linux kernel.**

### Why We Don't Wipe Android (The Dockerless Approach)
Many traditional self-hosted tools (like Coolify or Dokku) fail on mobile phones because they require **Docker** and Linux `systemd`, which need 2GB+ RAM just for the platform and require root access or custom ROMs.

**PhonixPaaS uses a native, Dockerless process architecture:**
* It runs directly in the Termux user space.
* Uses native Node.js process trees and `.env` file generation.
* The entire platform consumes **less than 35MB of RAM**, leaving 95%+ of the phone's memory free for your actual applications.

---

## 3. Architecture: Control Plane vs. Data Plane

To ensure the phone does not run hot 24/7, PhonixPaaS divides work into two layers:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   CONTROL PLANE (Always Ready)                         │
│  • Runs on Port 4000                                                   │
│  • Consumes <0.1% CPU and ~28MB RAM                                    │
│  • Displays battery %, temperature, project list, and live logs        │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                   [ User clicks "Active" in Dashboard ]
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   DATA PLANE (Spins Up On-Demand)                      │
│  • Portfolio Site    (:3001)  ──> [ 🟢 LIVE ]                          │
│  • Backend REST API  (:3002)  ──> [ ⏸️ STANDBY ] (Uses 0% CPU & 0 RAM) │
│  • Fullstack App     (:3003)  ──> [ ⏸️ STANDBY ] (Uses 0% CPU & 0 RAM) │
└────────────────────────────────────────────────────────────────────────┘
```

When you are done demonstrating a project, you toggle it to **Standby** (or click **"Sleep All"**). The phone process is terminated, memory is cleared, and CPU usage drops to 0%.

---

## 4. Step-by-Step Setup Guide

### Phase 1: Preparing the Old Phone
1. **(Optional) Factory Reset:** Clear old apps and photos to give the phone maximum storage and clean RAM.
2. **Connect to Home Wi-Fi:** Ensure the phone is connected to the same Wi-Fi network as your laptop.
3. **Disable Battery Optimization (Crucial):**
   * Go to **Settings $\to$ Apps $\to$ Termux $\to$ Battery**.
   * Set battery usage to **"Unrestricted"** (or turn off "Battery Optimization"). This prevents Android from killing your server in sleep mode.
4. **Keep Wi-Fi Active During Sleep:**
   * In Android Settings $\to$ Wi-Fi $\to$ Advanced $\to$ Set *"Keep Wi-Fi on during sleep"* to **Always**.

---

### Phase 2: Setting Up the Linux Runtime (Termux)

> [!IMPORTANT]
> **Do NOT install Termux from the Google Play Store.** The Play Store build is deprecated and receives no updates.

1. Download and install **Termux** from [F-Droid](https://f-droid.org/en/packages/com.termux/).
2. Download and install **Termux:API** from [F-Droid](https://f-droid.org/en/packages/com.termux.api/) (this allows PhonixPaaS to read real hardware battery levels and temperatures).
3. Open Termux on the phone and run:
   ```bash
   # Acquire wake lock so the CPU stays awake when the screen turns off
   termux-wake-lock

   # Update package lists
   pkg update -y && pkg upgrade -y

   # Install Node.js, Git, and Termux API packages
   pkg install -y nodejs git termux-api openssh
   ```

---

### Phase 3: Installing PhonixPaaS

Inside Termux on your phone, run:

```bash
# 1. Clone the repository
git clone https://github.com/your-username/phonix-paas.git ~/phonix-paas

# 2. Enter directory and run the automated installer
cd ~/phonix-paas
bash scripts/install.sh
```

The installer will:
1. Install all dependencies (`npm install --omit=dev`).
2. Configure **Termux:Boot** so PhonixPaaS automatically restarts if the phone reboots.
3. Print your phone's local network IP address (e.g., `192.168.1.45`).

To launch the server:
```bash
npm start
```
You will see:
```text
======================================================
 🔥 PhonixPaaS is running at: http://localhost:4000
 🔋 Battery-Aware Self-Hosted PaaS Engine Active
======================================================
```

---

### Phase 4: Remote Management from Your Laptop

Once `npm start` is running on the phone, **you never need to touch the phone's screen again.**

1. On your laptop, open any web browser (Chrome, Edge, Firefox, Safari).
2. Enter your phone's IP address:
   ```text
   http://192.168.1.45:4000
   ```
   *(Replace `192.168.1.45` with the IP address printed by the installer).*
3. The **PhonixPaaS Dashboard** opens up:
   * View real-time battery % and temperature in the top bar.
   * Click **`+ Create new project`** to deploy any GitHub repo.
   * Configure environment variables (`.env`) directly in the modal.
   * Use the **Active / Sleep** toggle switch to bring your sites online or put them to sleep.
   * Click **Logs** to view live build outputs and error messages.

---

## 5. Connecting to the World: Free HTTPS Without Port Forwarding

Right now, your server is accessible on your home Wi-Fi. To make your projects visible to anyone in the world (e.g., sharing a portfolio link with a recruiter):

### The Traditional Problem (Port Forwarding & CGNAT)
In the past, you had to log into your home Wi-Fi router, forward ports `80` and `443`, and set up dynamic DNS. Most modern internet service providers (ISPs) use **CGNAT**, which completely blocks incoming port connections.

### The Modern Solution: Cloudflare Tunnels (`cloudflared`)
Cloudflare Tunnels create a secure, outbound connection from your phone to Cloudflare's edge network:
* **100% Free.**
* **Zero router configuration** or open ports needed.
* **Free HTTPS / SSL encryption.**
* Bypasses CGNAT automatically.

#### How to Enable Cloudflare Tunnel on the Phone:
Inside Termux on the phone:
```bash
# Install cloudflared
pkg install -y cloudflared

# Expose your project (e.g., project running on port 3001)
cloudflared tunnel --url http://localhost:3001
```
Cloudflare will output a public URL:
```text
https://random-subdomain.trycloudflare.com
```
Anyone on earth can now visit that URL, and Cloudflare will route their request down the encrypted tunnel directly to your phone!

*(You can also connect your own custom domain, like `portfolio.yourname.com`, for free in your Cloudflare dashboard).*

---

## 6. Automated CI/CD: Deploy on `git push`

To match the Vercel/Render developer experience:
1. In your PhonixPaaS dashboard, each project provides a webhook endpoint:
   ```text
   http://<your-public-url>/api/webhook/<project-id>
   ```
2. In your GitHub repository:
   * Go to **Settings $\to$ Webhooks $\to$ Add Webhook**.
   * Paste your webhook URL.
   * Select event: **"Just the push event"**.
3. Now, whenever you run `git push origin main` on your laptop, GitHub pings your phone. Your phone automatically runs `git pull`, rebuilds the site, and restarts the service!

---

## 7. Hardware Care: Battery Swelling & Thermal Protection

Leaving any lithium-ion battery plugged into a standard wall charger 24 hours a day, 7 days a week, will eventually cause the battery to degrade or swell. Follow these best practices:

### 1. The 20%–80% Rule (Battery Lifespan)
Lithium-ion batteries experience minimal chemical stress when kept between **20% and 80% charge**:
* **Smart Plug Solution (Recommended):** Plug your phone charger into an inexpensive Wi-Fi smart plug (Tuya, Tapo, Sonoff). Set an automated timer to turn the charger on for 1 hour every 6 hours.
* **Charge Limiting Apps:** If your phone is rooted, tools like `acc` (Advanced Charging Controller) automatically pause charging when the battery hits 75%.
* **AccuBattery:** On unrooted phones, install AccuBattery to monitor charge health and receive acoustic alerts.

### 2. Thermal Management
* Keep the phone on a hard, flat surface (desk or shelf). Do **not** keep it in a closed drawer, on a bed, or under direct sunlight.
* PhonixPaaS monitors temperature via `termux-battery-status`. If temperature exceeds **42°C**, the dashboard status indicator turns amber. Use the **"Sleep All"** button to allow the hardware to cool down.

### 3. Screen Off
Always keep the phone's screen turned off. Because `termux-wake-lock` is enabled, the processor remains running while the OLED/LCD display rests, saving power and eliminating heat.

---

## 8. Troubleshooting & Quick Cheatsheet

| Issue | Cause | Fix |
| :--- | :--- | :--- |
| **Server stops when screen turns off** | Android put CPU to sleep | Run `termux-wake-lock` in Termux and disable battery optimization in Android Settings. |
| **Cannot open `http://<ip>:4000` from laptop** | Laptop and phone on different Wi-Fi networks | Ensure both devices are connected to the same Wi-Fi router (not mobile hotspot/guest network). |
| **Git clone fails: permission denied** | Git repository is private | Use a Personal Access Token in the URL: `https://<token>@github.com/user/repo.git` |
| **Phone rebooted and server is offline** | System restart | Install `Termux:Boot` from F-Droid to enable automatic launch on boot. |

### Essential Phone Terminal Commands

```bash
# Check your phone's local IP address
ifconfig wlan0 | grep "inet "

# View battery level and temperature manually
termux-battery-status

# Keep CPU running in background
termux-wake-lock

# Start PhonixPaaS manually
cd ~/phonix-paas && npm start

# Stop running process
Ctrl + C
```

---

*Authored for the **PhonixPaaS** open-source project.*
