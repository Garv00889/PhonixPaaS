#!/data/data/com.termux/files/usr/bin/bash
# PhonixPaaS Auto-Boot Hook for Termux:Boot

# Keep CPU alive
termux-wake-lock

# Launch server in background
cd "$(dirname "$0")/.."
node server.js >> "$HOME/phonix.log" 2>&1 &
