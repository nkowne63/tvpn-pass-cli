import { JSDOM } from 'jsdom'
import dotenv from 'dotenv'

dotenv.config()

const UID = process.env.V_UID
const PATTERN = process.env.V_PATTERN.split(",").map(Number)
const STATIC = process.env.V_STATIC

const result = await fetch("https://tauth-plgw1.t.u-tokyo.ac.jp/ui/index.php", {
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