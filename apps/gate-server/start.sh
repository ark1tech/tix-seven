#!/bin/bash
set -e

echo "Setting up VPN and Credentials..."

mkdir -p /etc/wireguard
mkdir -p credentials

# Decode and Setup Wireproxy Configuration
if [ -n "$WG_CONFIG_B64" ]; then
    echo "$WG_CONFIG_B64" | base64 -d > /etc/wireguard/wg0.conf
    
    # Generate wireproxy conf from standard wg conf
    # wireproxy uses standard wg conf syntax plus a [Socks5] section
    cat /etc/wireguard/wg0.conf > /etc/wireguard/wireproxy.conf
    echo -e "\n[Socks5]" >> /etc/wireguard/wireproxy.conf
    echo "BindAddress = 127.0.0.1:1080" >> /etc/wireguard/wireproxy.conf
    
    echo "Starting Wireproxy (Userspace WireGuard SOCKS5 Tunnel)..."
    wireproxy -c /etc/wireguard/wireproxy.conf -d &
    
    # Tell the application to use the SOCKS5 proxy for MOSIP requests
    export MOSIP_USE_SOCKS5_PROXY=true
    
    # Give the proxy a moment to start
    sleep 2
else
    echo "Warning: WG_CONFIG_B64 is not set. Skipping WireGuard setup."
fi

# Decode and Setup MOSIP Credentials
if [ -n "$MOSIP_PEM_B64" ]; then
    echo "$MOSIP_PEM_B64" | base64 -d > credentials/pdec_ida_partner.pem
fi

if [ -n "$MOSIP_KEYSTORE_B64" ]; then
    echo "$MOSIP_KEYSTORE_B64" | base64 -d > credentials/keystore.p12
fi

if [ -n "$MOSIP_SIGNED_KEYSTORE_B64" ]; then
    echo "$MOSIP_SIGNED_KEYSTORE_B64" | base64 -d > credentials/keystore-signed.p12
fi

echo "Starting Application..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
