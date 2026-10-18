import { JSDOM } from 'jsdom'
import dotenv from 'dotenv'
import { parsePattern } from './pattern.mjs'

dotenv.config()

const UID = process.env.V_UID
const PATTERN = parsePattern(process.env.V_PATTERN)
const STATIC = process.env.V_STATIC
const VPN_AUTH_URL = process.env.VPN_AUTH_URL

if (!VPN_AUTH_URL) {
    console.error('[ERROR] Missing required environment variable: VPN_AUTH_URL')
    process.exit(1)
}

const result = await fetch(VPN_AUTH_URL, {
    "headers": {
      "accept": "text/html",
      "content-type": "application/x-www-form-urlencoded",
    },
    "body": `action=confirm&uid=${UID}`,
    "method": "POST"
  });
const text = await result.text();
const { window } = new JSDOM(text)
const numbersElements = Array.from(window.document.querySelectorAll(".randamNumberBoxRadius > p"))
const numbers = numbersElements.map(el => Number(el.innerHTML))

const oneTimePass = PATTERN.map(idx => numbers[idx]).join("") + STATIC

console.log(oneTimePass);