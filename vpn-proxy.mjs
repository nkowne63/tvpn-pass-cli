import { JSDOM } from 'jsdom'
import dotenv from 'dotenv'
import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'

dotenv.config()

const execAsync = promisify(exec)

const UID = process.env.V_UID
const PATTERN = process.env.V_PATTERN.split(",").map(Number)
const STATIC = process.env.V_STATIC
const VPN_SERVER = process.env.VPN_SERVER
const IPSEC_PSK = process.env.VPN_PSK
const VPN_AUTH_URL = process.env.VPN_AUTH_URL
const RECONNECT_INTERVAL = parseInt(process.env.RECONNECT_INTERVAL || '300') * 1000

if (!VPN_SERVER || !IPSEC_PSK || !VPN_AUTH_URL) {
    console.error('[ERROR] Missing required environment variables: VPN_SERVER, VPN_PSK, VPN_AUTH_URL')
    process.exit(1)
}

let ipsecProcess = null
let vpnProcess = null
let socksProcess = null
let isConnected = false

// Get one-time password
async function getOneTimePassword() {
    try {
        const result = await fetch(VPN_AUTH_URL, {
            "headers": {
                "accept": "text/html",
                "content-type": "application/x-www-form-urlencoded",
            },
            "body": `action=confirm&uid=${UID}`,
            "method": "POST"
        })

        const text = await result.text()
        const { window } = new JSDOM(text)
        const numbersElements = Array.from(window.document.querySelectorAll(".randamNumberBoxRadius > p"))
        const numbers = numbersElements.map(el => Number(el.innerHTML))

        const oneTimePass = PATTERN.map(idx => numbers[idx]).join("") + STATIC
        return oneTimePass
    } catch (error) {
        console.error('[ERROR] Failed to get one-time password:', error.message)
        throw error
    }
}

// Create L2TP/IPsec connection configuration
async function createL2TPConfig(password) {
    // IPsec configuration
    const ipsecConf = `config setup
    charondebug="ike 2, knl 2, cfg 2, net 2, esp 2, dmn 2, mgr 2"

conn %default
    ikelifetime=60m
    keylife=20m
    rekeymargin=3m
    keyingtries=%forever
    keyexchange=ikev1
    authby=secret
    ike=aes256-sha256-modp1024,aes256-sha1-modp1024,aes128-sha1-modp1024!
    esp=aes256-sha256-modp1024,aes256-sha1-modp1024,aes128-sha1-modp1024!
    dpdaction=restart
    dpddelay=30s
    dpdtimeout=120s

conn tvpn
    keyexchange=ikev1
    left=%defaultroute
    auto=add
    authby=secret
    type=transport
    leftprotoport=17/1701
    rightprotoport=17/1701
    right=${VPN_SERVER}
    rightid=%any
    forceencaps=yes
`

    // IPsec secrets (Pre-Shared Key)
    // Accept any peer ID with this PSK
    const ipsecSecrets = `%any : PSK "${IPSEC_PSK}"
`

    // xl2tpd configuration
    const xl2tpdConf = `[lac tvpn]
lns = ${VPN_SERVER}
ppp debug = yes
pppoptfile = /etc/ppp/options.xl2tpd
length bit = yes
`

    // PPP options for xl2tpd
    const pppOptions = `ipcp-accept-local
ipcp-accept-remote
refuse-eap
refuse-chap
refuse-mschap
refuse-mschap-v2
require-pap
noauth
noccp
defaultroute
mtu 1200
mru 1200
lock
noipdefault
usepeerdns
connect-delay 5000
user ${UID}
logfile /var/log/ppp.log
debug
`

    // PAP secrets file for authentication
    const papSecrets = `${UID} * ${password} *
`

    await fs.writeFile('/etc/ipsec.conf', ipsecConf)
    await fs.writeFile('/etc/ipsec.secrets', ipsecSecrets)
    await fs.writeFile('/etc/xl2tpd/xl2tpd.conf', xl2tpdConf)
    await fs.writeFile('/etc/ppp/options.xl2tpd', pppOptions)
    await fs.writeFile('/etc/ppp/pap-secrets', papSecrets)

    console.log('[INFO] L2TP/IPsec configuration created')
}

// Connect to VPN
async function connectVPN() {
    try {
        console.log('[INFO] Getting one-time password...')
        const password = await getOneTimePassword()
        console.log('[INFO] Password obtained')

        console.log('[INFO] Creating L2TP/IPsec configuration...')
        await createL2TPConfig(password)

        console.log('[INFO] Starting IPsec...')

        // Start strongSwan IPsec
        ipsecProcess = spawn('ipsec', ['start', '--nofork'], {
            stdio: ['ignore', 'pipe', 'pipe']
        })

        ipsecProcess.stdout.on('data', (data) => {
            console.log(`[IPsec] ${data.toString().trim()}`)
        })

        ipsecProcess.stderr.on('data', (data) => {
            console.log(`[IPsec] ${data.toString().trim()}`)
        })

        // Wait for IPsec daemon to start
        await new Promise(resolve => setTimeout(resolve, 3000))

        console.log('[INFO] Establishing IPsec connection...')

        // Start IPsec connection
        await execAsync('ipsec up tvpn')
        console.log('[INFO] IPsec connection initiated')

        // Wait for IPsec connection to fully establish
        await new Promise((resolve, reject) => {
            let attempts = 0
            const checkInterval = setInterval(async () => {
                attempts++
                try {
                    const { stdout } = await execAsync('ipsec status tvpn')
                    if (stdout.includes('ESTABLISHED')) {
                        clearInterval(checkInterval)
                        console.log('[INFO] IPsec connection established')
                        resolve()
                    }
                } catch (error) {
                    // IPsec not yet established
                }

                if (attempts > 30) {
                    clearInterval(checkInterval)
                    reject(new Error('IPsec connection timeout'))
                }
            }, 1000)
        })

        // Wait a bit more for IPsec to stabilize
        await new Promise(resolve => setTimeout(resolve, 3000))

        console.log('[INFO] Starting xl2tpd...')

        // Create xl2tpd control directory
        await execAsync('mkdir -p /var/run/xl2tpd')

        // Start xl2tpd
        vpnProcess = spawn('xl2tpd', ['-D', '-c', '/etc/xl2tpd/xl2tpd.conf'], {
            stdio: ['ignore', 'pipe', 'pipe']
        })

        vpnProcess.stdout.on('data', (data) => {
            console.log(`[xl2tpd] ${data.toString().trim()}`)
        })

        vpnProcess.stderr.on('data', (data) => {
            console.log(`[xl2tpd] ${data.toString().trim()}`)
        })

        vpnProcess.on('exit', (code) => {
            console.log(`[xl2tpd] Process exited with code ${code}`)
            isConnected = false
        })

        // Wait for xl2tpd to start
        await new Promise(resolve => setTimeout(resolve, 2000))

        console.log('[INFO] Establishing L2TP connection...')

        // Start L2TP connection
        await execAsync('echo "c tvpn" > /var/run/xl2tpd/l2tp-control')

        // Wait for connection
        await new Promise((resolve, reject) => {
            let attempts = 0
            const checkInterval = setInterval(async () => {
                attempts++
                try {
                    const { stdout } = await execAsync('ip addr show ppp0')
                    if (stdout.includes('inet ')) {
                        clearInterval(checkInterval)
                        isConnected = true
                        console.log('[INFO] VPN connected successfully')
                        console.log(`[INFO] PPP interface details: ${stdout.split('\n').filter(l => l.includes('inet')).join(', ')}`)
                        resolve()
                    }
                } catch (error) {
                    // ppp0 interface not yet available
                    if (attempts % 10 === 0) {
                        console.log(`[INFO] Waiting for L2TP connection... (${attempts}s)`)
                    }
                }

                if (attempts > 90) {
                    clearInterval(checkInterval)
                    reject(new Error('L2TP/PPP connection timeout after 90 seconds'))
                }
            }, 1000)
        })

        // Add route for internal network via VPN
        console.log('[INFO] Adding route for internal network...')
        try {
            await execAsync('ip route add 10.0.0.0/8 dev ppp0')
            console.log('[INFO] Route added: 10.0.0.0/8 via ppp0')
        } catch (error) {
            console.log(`[WARN] Failed to add route: ${error.message}`)
        }

        // Add MSS clamping for TCP to avoid fragmentation issues with PPP MTU
        // Use clamp-mss-to-pmtu for dynamic adjustment based on path MTU
        console.log('[INFO] Configuring MSS clamping for ppp0...')
        try {
            await execAsync('iptables -t mangle -A POSTROUTING -p tcp --tcp-flags SYN,RST SYN -o ppp0 -j TCPMSS --clamp-mss-to-pmtu')
            await execAsync('iptables -t mangle -A PREROUTING -p tcp --tcp-flags SYN,RST SYN -i ppp0 -j TCPMSS --clamp-mss-to-pmtu')
            console.log('[INFO] MSS clamping configured (clamp-to-PMTU)')
        } catch (error) {
            console.log(`[WARN] Failed to configure MSS clamping: ${error.message}`)
        }

        // Start SOCKS5 proxy
        await startSOCKSProxy()

    } catch (error) {
        console.error('[ERROR] Failed to connect VPN:', error.message)
        throw error
    }
}

// Start SOCKS5 proxy server
async function startSOCKSProxy() {
    try {
        console.log('[INFO] Starting SOCKS5 proxy server...')

        socksProcess = spawn('danted', ['-f', '/etc/danted.conf'], {
            stdio: ['ignore', 'pipe', 'pipe']
        })

        socksProcess.stdout.on('data', (data) => {
            console.log(`[SOCKS5] ${data.toString().trim()}`)
        })

        socksProcess.stderr.on('data', (data) => {
            console.log(`[SOCKS5] ${data.toString().trim()}`)
        })

        socksProcess.on('exit', (code) => {
            console.log(`[SOCKS5] Proxy server exited with code ${code}`)
        })

        // Wait a bit for the proxy to start
        await new Promise(resolve => setTimeout(resolve, 2000))

        console.log('[INFO] SOCKS5 proxy server started on port 1080')
    } catch (error) {
        console.error('[ERROR] Failed to start SOCKS5 proxy:', error.message)
        throw error
    }
}

// Check VPN connection status
async function checkConnection() {
    try {
        const { stdout } = await execAsync('ip addr show ppp0')
        return stdout.includes('inet ')
    } catch (error) {
        return false
    }
}

// Disconnect VPN
async function disconnectVPN() {
    console.log('[INFO] Disconnecting VPN...')

    if (socksProcess) {
        socksProcess.kill()
        socksProcess = null
    }

    if (vpnProcess) {
        vpnProcess.kill()
        vpnProcess = null
    }

    // Stop IPsec connection
    try {
        await execAsync('ipsec down tvpn')
        await execAsync('ipsec stop')
        console.log('[INFO] IPsec stopped')
    } catch (error) {
        console.log('[WARN] Failed to stop IPsec:', error.message)
    }

    if (ipsecProcess) {
        ipsecProcess.kill()
        ipsecProcess = null
    }

    isConnected = false

    // Wait a bit for cleanup
    await new Promise(resolve => setTimeout(resolve, 2000))
}

// Main monitoring loop
async function monitorConnection() {
    while (true) {
        try {
            const connected = await checkConnection()

            if (!connected && isConnected) {
                console.log('[WARN] VPN connection lost, reconnecting...')
                await disconnectVPN()
                await connectVPN()
            } else if (!connected && !isConnected) {
                console.log('[INFO] Attempting initial connection...')
                await connectVPN()
            } else {
                console.log('[INFO] VPN connection is healthy')
            }
        } catch (error) {
            console.error('[ERROR] Connection check failed:', error.message)
            console.log(`[INFO] Retrying in ${RECONNECT_INTERVAL / 1000} seconds...`)
        }

        await new Promise(resolve => setTimeout(resolve, RECONNECT_INTERVAL))
    }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    console.log('[INFO] Received SIGTERM, shutting down...')
    await disconnectVPN()
    process.exit(0)
})

process.on('SIGINT', async () => {
    console.log('[INFO] Received SIGINT, shutting down...')
    await disconnectVPN()
    process.exit(0)
})

// Start the service
console.log('[INFO] T-VPN SOCKS5 Proxy Service starting...')
console.log(`[INFO] Connection Type: L2TP/IPsec`)
console.log(`[INFO] UID: ${UID}`)
console.log(`[INFO] VPN Server: ${VPN_SERVER}`)
console.log(`[INFO] IPsec PSK: ${IPSEC_PSK ? '***' : 'not set'}`)
console.log(`[INFO] Reconnect Interval: ${RECONNECT_INTERVAL / 1000}s`)

monitorConnection().catch(error => {
    console.error('[FATAL] Service error:', error)
    process.exit(1)
})
