FROM node:20-slim

# Install required packages for VPN and SOCKS5 proxy
RUN apt-get update && apt-get install -y \
    xl2tpd \
    strongswan \
    strongswan-pki \
    ppp \
    iptables \
    iproute2 \
    dante-server \
    curl \
    procps \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Copy SOCKS5 proxy configuration
COPY danted.conf /etc/danted.conf

# Expose SOCKS5 proxy port
EXPOSE 1080

# Run with privileged mode for VPN operations
CMD ["node", "vpn-proxy.mjs"]
