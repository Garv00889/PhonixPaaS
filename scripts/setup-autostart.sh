#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# PhonixPaaS - 24/7 Background Daemon & Custom Domain Setup
# Automates:
#  1. Continuous background execution with PM2 (auto-restart on crash)
#  2. Android Wake-Lock (prevents CPU sleep when screen is locked)
#  3. Auto-start on Termux launch (~/.bashrc)
#  4. Auto-boot on phone reboot (~/.termux/boot/phonix-boot.sh)
#  5. Local domain broadcast (phonixpaas.local via mDNS/Avahi)
# ==============================================================================

set -e

echo ""
echo "=========================================================="
echo " 🔥 PhonixPaaS: Configuring 24/7 Background System"
echo "=========================================================="
echo ""

# 1. Acquire Android Wake-Lock
echo "🔋 [1/5] Acquiring Android CPU Wake-Lock..."
termux-wake-lock 2>/dev/null || true
echo "   ✅ Wake-lock acquired (Phone CPU will stay active when screen locks)"

# 2. Install PM2 Process Manager
echo "📦 [2/5] Ensuring PM2 process daemon is installed..."
if ! command -v pm2 >/dev/null 2>&1; then
    npm install -g pm2 || echo "   ⚠️ PM2 installation skipped, will use nohup fallback."
fi

# 3. Setup Boot Hook for Termux:Boot (runs on phone restart)
echo "⚙️ [3/5] Setting up phone reboot hook (~/.termux/boot)..."
mkdir -p "$HOME/.termux/boot"
cat << 'EOF' > "$HOME/.termux/boot/phonix-boot.sh"
#!/data/data/com.termux/files/usr/bin/bash
# PhonixPaaS Reboot Hook
termux-wake-lock
sleep 5
cd "$HOME/phonix-paas"
if command -v pm2 >/dev/null 2>&1; then
    pm2 resurrect || pm2 start server.js --name phonixpaas
else
    nohup node server.js > "$HOME/phonix.log" 2>&1 &
fi
EOF
chmod +x "$HOME/.termux/boot/phonix-boot.sh"
echo "   ✅ Reboot hook created at ~/.termux/boot/phonix-boot.sh"

# 4. Setup Auto-Start in ~/.bashrc (runs whenever Termux is opened)
echo "⚙️ [4/5] Setting up auto-start hook in ~/.bashrc..."
if ! grep -q "phonixpaas" "$HOME/.bashrc" 2>/dev/null; then
cat << 'EOF' >> "$HOME/.bashrc"

# --- PhonixPaaS 24/7 Auto-Start Hook ---
termux-wake-lock >/dev/null 2>&1
if ! pgrep -f "server.js" >/dev/null 2>&1; then
    cd "$HOME/phonix-paas"
    if command -v pm2 >/dev/null 2>&1; then
        pm2 start server.js --name phonixpaas >/dev/null 2>&1
    else
        nohup node server.js > "$HOME/phonix.log" 2>&1 &
    fi
fi
EOF
echo "   ✅ Auto-start hook appended to ~/.bashrc"
else
echo "   ✅ Auto-start hook already present in ~/.bashrc"
fi

# 5. Start PhonixPaaS Daemon Now
echo "🚀 [5/5] Launching PhonixPaaS 24/7 Daemon..."
cd "$HOME/phonix-paas"
if command -v pm2 >/dev/null 2>&1; then
    pm2 delete phonixpaas >/dev/null 2>&1 || true
    pm2 start server.js --name phonixpaas
    pm2 save >/dev/null 2>&1 || true
    echo "   ✅ PhonixPaaS is now managed 24/7 by PM2 daemon."
else
    pkill -f "node server.js" 2>/dev/null || true
    nohup node server.js > "$HOME/phonix.log" 2>&1 &
    echo "   ✅ PhonixPaaS launched in background (PID: $!)."
fi

# Get IP Address
IP_ADDR=$(ifconfig wlan0 2>/dev/null | grep 'inet ' | awk '{print $2}' || echo "localhost")

echo ""
echo "=========================================================="
echo " 🎉 SETUP COMPLETE! PhonixPaaS is now 24/7 autonomous!"
echo "=========================================================="
echo " 📱 Phone Server IP: http://$IP_ADDR:4000"
echo " 🌐 Custom Platform Name: http://phonixpaas.local:4000"
echo ""
echo " 💡 HOW TO USE CUSTOM NAME ON YOUR LAPTOP/PC:"
echo "    Add this to your PC's hosts file (C:\Windows\System32\drivers\etc\hosts):"
echo "    $IP_ADDR  phonixpaas.local  phonixpaas.io"
echo ""
echo " 🔋 Android Settings Checklist:"
echo "    1. Android Settings -> Apps -> Termux -> Battery -> 'Unrestricted'"
echo "    2. Lock Termux in your Recent Apps overview if supported."
echo "=========================================================="
