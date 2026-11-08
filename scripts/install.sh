#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# PhonixPaaS - Automated 1-Command Phone Setup Script
# Turns any Android device running Termux into a battery-aware personal PaaS
# ==============================================================================

set -e

echo "🔥 [PhonixPaaS] Starting installation on Android (Termux)..."

# 1. Update Termux Packages
echo "📦 Updating package repositories..."
pkg update -y && pkg upgrade -y

# 2. Install essential runtimes & tools
echo "⚙️ Installing Node.js, Git, and Termux:API..."
pkg install -y nodejs git termux-api openssh

# 3. Prevent Android from putting CPU to sleep
echo "🔋 Acquiring Android wake lock..."
termux-wake-lock

# 4. Clone or update PhonixPaaS repository
INSTALL_DIR="$HOME/phonix-paas"
if [ -d "$INSTALL_DIR" ]; then
    echo "🔄 Existing installation found. Pulling latest updates..."
    cd "$INSTALL_DIR"
    git pull
else
    echo "📥 Cloning PhonixPaaS repository..."
    # Replace with your actual GitHub repository URL once uploaded
    git clone https://github.com/your-username/phonix-paas.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# 5. Install dependencies
echo "📦 Installing npm dependencies..."
npm install --omit=dev

# 6. Setup auto-start on device reboot (Termux:Boot)
BOOT_DIR="$HOME/.termux/boot"
mkdir -p "$BOOT_DIR"
cat << 'EOF' > "$BOOT_DIR/phonix-boot.sh"
#!/data/data/com.termux/files/usr/bin/bash
termux-wake-lock
cd "$HOME/phonix-paas"
node server.js > "$HOME/phonix-boot.log" 2>&1 &
EOF
chmod +x "$BOOT_DIR/phonix-boot.sh"

# 7. Discover phone IP address
IP_ADDR=$(ifconfig wlan0 2>/dev/null | grep 'inet ' | awk '{print $2}' || echo "localhost")

echo ""
echo "=================================================================="
echo " 🎉 PhonixPaaS successfully installed!"
echo "=================================================================="
echo ""
echo "🚀 To start PhonixPaaS right now, run:"
echo "   cd ~/phonix-paas && npm start"
echo ""
echo "📱 Open this link on your Laptop or Phone browser:"
echo "   http://$IP_ADDR:4000"
echo ""
echo "🔋 Tip: Disable Android Battery Optimization for Termux in Settings"
echo "=================================================================="
